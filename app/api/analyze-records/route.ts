import { NextResponse } from 'next/server';
import { getConnectionByRole, getConnectionWithPassword } from '@/lib/database/credential-manager';
import { getOdooPool } from '@/lib/database/connection';
import { analyzeRecordCompatibility } from '@/lib/migration/record-analyzer';
import { getConfigPool, executeQuery } from '@/lib/database/connection';
import { TableComparisonDetail } from '@/lib/migration/table-comparator';

/**
 * POST /api/analyze-records
 * Analyze record compatibility for tables with compatible and incompatible differences
 */
export async function POST() {

  try {
    // Get the latest analysis result to get table details
    const configPool = getConfigPool();
    const analysisQuery = `
      SELECT 
        tables_with_data,
        tables_missing_in_target,
        tables_with_identical_records,
        tables_with_compatible_diff,
        tables_with_incompatible_diff,
        table_comparison_details
      FROM analysis_results
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const analysisResults = await executeQuery<{
      tables_with_data: number;
      tables_missing_in_target: number;
      tables_with_identical_records: number;
      tables_with_compatible_diff: number;
      tables_with_incompatible_diff: number;
      table_comparison_details: TableComparisonDetail[];
    }>(configPool, analysisQuery);

    if (analysisResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No analysis results found. Please run table comparison first.' },
        { status: 400 }
      );
    }

    const tableDetails = analysisResults[0].table_comparison_details;

    if (!tableDetails || !Array.isArray(tableDetails)) {
      return NextResponse.json(
        { success: false, error: 'Invalid table details in analysis results' },
        { status: 400 }
      );
    }

    // Filter tables by category
    const compatibleTables = tableDetails
      .filter((t: TableComparisonDetail) => t.category === 'compatible_diff')
      .map((t: TableComparisonDetail) => ({
        tableName: t.tableName,
        sourceRecordCount: t.sourceRecordCount,
      }));

    const incompatibleTables = tableDetails
      .filter((t: TableComparisonDetail) => t.category === 'incompatible_diff')
      .map((t: TableComparisonDetail) => ({
        tableName: t.tableName,
        sourceRecordCount: t.sourceRecordCount,
      }));

    if (compatibleTables.length === 0 && incompatibleTables.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          compatibleDiffTables: [],
          incompatibleDiffTables: [],
          summary: {
            totalTablesAnalyzed: 0,
            totalCompatibleTables: 0,
            totalIncompatibleTables: 0,
            totalRecords: 0,
            ceCompatibleRecords: 0,
            eeOnlyRecords: 0,
          },
        },
      });
    }

    // Get database connections
    const sourceConnection = await getConnectionByRole('source_ee');
    const targetConnection = await getConnectionByRole('target_ce');

    if (!sourceConnection || !targetConnection) {
      return NextResponse.json(
        { success: false, error: 'Source or target database connection not configured' },
        { status: 400 }
      );
    }

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

    // Perform record compatibility analysis
    const result = await analyzeRecordCompatibility(
      sourcePool,
      targetPool,
      compatibleTables,
      incompatibleTables
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error analyzing record compatibility:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze record compatibility',
      },
      { status: 500 }
    );
  }
}
