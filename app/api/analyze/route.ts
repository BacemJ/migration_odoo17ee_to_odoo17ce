import { NextResponse } from 'next/server';
import { getConfigPool, executeQuery } from '@/lib/database/connection';
import { getConnectionByRole } from '@/lib/database/credential-manager';
import { analyzeSourceDatabase, saveAnalysisResults } from '@/lib/migration/analyzer';

/**
 * POST /api/analyze
 * Analyze source EE database
 */
export async function POST() {
  try {
    // Get source connection
    const sourceConnection = await getConnectionByRole('source_ee');
    
    if (!sourceConnection) {
      return NextResponse.json(
        { success: false, error: 'Source EE database connection not configured' },
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
      [JSON.stringify({ source_connection_id: sourceConnection.id })]
    );

    const jobId = jobResult[0].id;

    // Perform analysis
    const analysisResult = await analyzeSourceDatabase(sourceConnection.id);

    // Save analysis results
    await saveAnalysisResults(jobId, analysisResult);

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
