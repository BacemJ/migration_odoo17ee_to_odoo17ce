import { NextRequest, NextResponse } from 'next/server';
import { getConfigPool, executeQuery, getOdooPool } from '@/lib/database/connection';
import { getConnectionByRole, getConnectionWithPassword } from '@/lib/database/credential-manager';
import { compareTablesBetweenDatabases } from '@/lib/migration/table-comparator';

/**
 * GET /api/analyze?latest=true
 * Retrieve the latest analysis results from the database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latest = searchParams.get('latest');

    if (latest !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Use ?latest=true to get the most recent analysis' },
        { status: 400 }
      );
    }

    const configPool = getConfigPool();

    // Get the most recent completed analysis
    const analysisResults = await executeQuery<{
      job_id: number;
      tables_with_data: number;
      tables_missing_in_target: number;
      tables_with_identical_records: number;
      tables_with_compatible_diff: number;
      tables_with_incompatible_diff: number;
      table_comparison_details: unknown;
      comparison_completed_at: Date;
    }>(
      configPool,
      `SELECT 
        job_id,
        tables_with_data,
        tables_missing_in_target,
        tables_with_identical_records,
        tables_with_compatible_diff,
        tables_with_incompatible_diff,
        table_comparison_details,
        comparison_completed_at
       FROM analysis_results
       WHERE comparison_completed_at IS NOT NULL
       ORDER BY comparison_completed_at DESC
       LIMIT 1`
    );

    if (analysisResults.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No previous analysis found',
      });
    }

    const result = analysisResults[0];
    // table_comparison_details is already a parsed object (jsonb column), no need to JSON.parse
    const tableDetails = result.table_comparison_details;

    return NextResponse.json({
      success: true,
      data: {
        job_id: result.job_id,
        comparison: {
          tablesWithData: result.tables_with_data,
          tablesMissingInTarget: result.tables_missing_in_target,
          tablesWithIdenticalRecords: result.tables_with_identical_records,
          tablesWithCompatibleDiff: result.tables_with_compatible_diff,
          tablesWithIncompatibleDiff: result.tables_with_incompatible_diff,
          tableDetails,
        },
        completedAt: result.comparison_completed_at,
      },
    });
  } catch (error) {
    console.error('Error retrieving last analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve last analysis',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analyze
 * Compare source EE and target CE databases
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

    // Save comparison results
    await executeQuery(
      configPool,
      `INSERT INTO analysis_results (
        job_id, 
        tables_with_data,
        tables_missing_in_target,
        tables_with_identical_records,
        tables_with_compatible_diff,
        tables_with_incompatible_diff,
        table_comparison_details,
        comparison_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        jobId,
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
