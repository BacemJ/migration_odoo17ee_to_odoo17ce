import { NextResponse } from 'next/server';
import { getConnectionByRole } from '@/lib/database/credential-manager';
import {
  exportAllModules,
  getExportProgress,
  initializeExportCheckpoints,
} from '@/lib/migration/exporter';
import { getConfigPool, executeQuery } from '@/lib/database/connection';

/**
 * POST /api/export
 * Start or resume export of EE data
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { success: false, error: 'job_id is required' },
        { status: 400 }
      );
    }

    // Get source connection
    const sourceConnection = await getConnectionByRole('source_ee');

    if (!sourceConnection) {
      return NextResponse.json(
        { success: false, error: 'Source EE database connection not configured' },
        { status: 400 }
      );
    }

    // Update job status
    const configPool = getConfigPool();
    await executeQuery(
      configPool,
      `UPDATE migration_jobs SET status = 'exporting' WHERE id = $1`,
      [job_id]
    );

    // Initialize checkpoints if not already done
    await initializeExportCheckpoints(job_id);

    // Start export (runs in background)
    exportAllModules(job_id, sourceConnection.id)
      .then(async () => {
        // Update job status on completion
        await executeQuery(
          configPool,
          `UPDATE migration_jobs SET status = 'pending' WHERE id = $1`,
          [job_id]
        );
      })
      .catch(async (error) => {
        console.error('Export failed:', error);
        await executeQuery(
          configPool,
          `UPDATE migration_jobs SET status = 'failed', error_message = $2 WHERE id = $1`,
          [job_id, error instanceof Error ? error.message : 'Export failed']
        );
      });

    return NextResponse.json({
      success: true,
      message: 'Export started',
      data: { job_id },
    });
  } catch (error) {
    console.error('Error starting export:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start export',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export?job_id=<id>
 * Get export progress
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

    const progress = await getExportProgress(parseInt(jobId));

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Error fetching export progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch progress',
      },
      { status: 500 }
    );
  }
}
