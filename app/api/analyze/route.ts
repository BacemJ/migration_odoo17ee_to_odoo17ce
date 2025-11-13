import { NextResponse } from 'next/server';
import { getConfigPool, executeQuery, getOdooPool } from '@/lib/database/connection';
import { getConnectionByRole, getConnectionWithPassword } from '@/lib/database/credential-manager';
import { analyzeSourceDatabase, saveAnalysisResults } from '@/lib/migration/analyzer';
import { compareTablesBetweenDatabases } from '@/lib/migration/table-comparator';

/**
 * POST /api/analyze
 * Analyze and compare source EE and target CE databases
 */
export async function POST() {
  try {
    // Get source and target connections
    const sourceConnection = await getConnectionByRole('source_ee');
    const targetConnection = await getConnectionByRole('target_ce');
    
    if (!sourceConnection) {
      return NextResponse.json(
        { success: false, error: 'Source EE database connection not configured' },
        { status: 400 }
      );
    }

    if (!targetConnection) {
      return NextResponse.json(
        { success: false, error: 'Target CE database connection not configured' },
        { status: 400 }
      );
    }

    // Create a new migration job
    const configPool = getConfigPool();
    const jobResult = await executeQuery<{ id: number }>(
      configPool,
      `INSERT INTO migration_jobs (status, config_json) 
       VALUES ('analyzing', $1) 
       RETURNING id`,
      [JSON.stringify({ 
        source_connection_id: sourceConnection.id,
        target_connection_id: targetConnection.id 
      })]
    );

    const jobId = jobResult[0].id;

    // Perform source analysis
    const analysisResult = await analyzeSourceDatabase(sourceConnection.id);

    // Get connection configurations with passwords for pool creation
    const sourceConfig = await getConnectionWithPassword(sourceConnection.id);
    const targetConfig = await getConnectionWithPassword(targetConnection.id);

    if (!sourceConfig || !targetConfig) {
      throw new Error('Failed to retrieve connection configurations');
    }

    // Create database pools
    const sourcePool = getOdooPool(`source_${sourceConnection.id}`, {
      host: sourceConfig.host,
      port: sourceConfig.port,
      database: sourceConfig.database,
      user: sourceConfig.username,
      password: sourceConfig.encrypted_password, // This is actually decrypted by getConnectionWithPassword
    });

    const targetPool = getOdooPool(`target_${targetConnection.id}`, {
      host: targetConfig.host,
      port: targetConfig.port,
      database: targetConfig.database,
      user: targetConfig.username,
      password: targetConfig.encrypted_password, // This is actually decrypted by getConnectionWithPassword
    });

    // Perform table comparison
    const comparisonResult = await compareTablesBetweenDatabases(sourcePool, targetPool);

    // Save analysis results with comparison data
    await executeQuery(
      configPool,
      `INSERT INTO analysis_results (
        job_id, 
        ee_modules_found, 
        ee_tables_found, 
        foreign_key_dependencies,
        record_counts,
        estimated_export_size_mb,
        risk_level,
        warnings,
        tables_with_data,
        tables_missing_in_target,
        tables_with_identical_records,
        tables_with_compatible_diff,
        tables_with_incompatible_diff,
        table_comparison_details,
        comparison_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
      [
        jobId,
        JSON.stringify(analysisResult.ee_modules_found),
        JSON.stringify(analysisResult.ee_tables_found),
        JSON.stringify(analysisResult.foreign_key_dependencies),
        JSON.stringify(analysisResult.record_counts),
        analysisResult.estimated_export_size_mb,
        analysisResult.risk_level,
        JSON.stringify(analysisResult.warnings),
        comparisonResult.tablesWithData,
        comparisonResult.tablesMissingInTarget,
        comparisonResult.tablesWithIdenticalRecords,
        comparisonResult.tablesWithCompatibleDiff,
        comparisonResult.tablesWithIncompatibleDiff,
        JSON.stringify(comparisonResult.tableDetails),
      ]
    );

    // Update job status
    await executeQuery(
      configPool,
      `UPDATE migration_jobs SET status = 'pending', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [jobId]
    );

    return NextResponse.json({
      success: true,
      data: {
        job_id: jobId,
        analysis: analysisResult,
        comparison: comparisonResult,
      },
    });
  } catch (error) {
    console.error('Error analyzing database:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze database',
      },
      { status: 500 }
    );
  }
}
