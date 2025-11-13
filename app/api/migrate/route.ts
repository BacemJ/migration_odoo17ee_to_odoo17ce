import { NextResponse } from 'next/server';
import { getConnectionByRole } from '@/lib/database/credential-manager';
import { getAnalysisResults } from '@/lib/migration/analyzer';
import { executeMigration, getMigrationStepsLog } from '@/lib/migration/executor';
import { getConfigPool, executeQuery } from '@/lib/database/connection';

/**
 * POST /api/migrate
 * Execute migration on staging database
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_id, dry_run = false } = body;

    if (!job_id) {
      return NextResponse.json(
        { success: false, error: 'job_id is required' },
        { status: 400 }
      );
    }

    // Get staging connection
    const stagingConnection = await getConnectionByRole('staging');

    if (!stagingConnection) {
      return NextResponse.json(
        { success: false, error: 'Staging database connection not configured' },
        { status: 400 }
      );
    }

    // Get analysis results
    const analysisResult = await getAnalysisResults(job_id);

    if (!analysisResult) {
      return NextResponse.json(
        { success: false, error: 'Analysis results not found. Please run analysis first.' },
        { status: 400 }
      );
    }

    // Update job status
    const configPool = getConfigPool();
    if (!dry_run) {
      await executeQuery(
        configPool,
        `UPDATE migration_jobs SET status = 'migrating', dry_run = $2 WHERE id = $1`,
        [job_id, dry_run]
      );
    }

    // Execute migration
    const migrationResult = await executeMigration(
      job_id,
      stagingConnection.id,
      analysisResult,
      dry_run
    );

    // Update job status
    if (!dry_run) {
      await executeQuery(
        configPool,
        `UPDATE migration_jobs 
         SET status = $2, completed_at = CURRENT_TIMESTAMP, error_message = $3 
         WHERE id = $1`,
        [
          job_id,
          migrationResult.success ? 'pending' : 'failed',
          migrationResult.errors.join('; ') || null,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: migrationResult,
    });
  } catch (error) {
    console.error('Error executing migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute migration',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate?job_id=<id>
 * Get migration steps log
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'job_id is required' },
        { status: 400 }
      );
    }

    const steps = await getMigrationStepsLog(parseInt(jobId));

    return NextResponse.json({
      success: true,
      data: steps,
    });
  } catch (error) {
    console.error('Error fetching migration steps:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch migration steps',
      },
      { status: 500 }
    );
  }
}
