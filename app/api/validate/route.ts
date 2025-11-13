import { NextResponse } from 'next/server';
import { getConnectionByRole } from '@/lib/database/credential-manager';
import { validateMigration, getValidationResults } from '@/lib/migration/validator';
import { getConfigPool, executeQuery } from '@/lib/database/connection';

/**
 * POST /api/validate
 * Validate staging database after migration
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

    // Get staging connection
    const stagingConnection = await getConnectionByRole('staging');

    if (!stagingConnection) {
      return NextResponse.json(
        { success: false, error: 'Staging database connection not configured' },
        { status: 400 }
      );
    }

    // Update job status
    const configPool = getConfigPool();
    await executeQuery(
      configPool,
      `UPDATE migration_jobs SET status = 'validating' WHERE id = $1`,
      [job_id]
    );

    // Perform validation
    const validationResult = await validateMigration(job_id, stagingConnection.id);

    // Update job status
    await executeQuery(
      configPool,
      `UPDATE migration_jobs 
       SET status = $2, completed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [job_id, validationResult.overall_status === 'pass' ? 'completed' : 'failed']
    );

    return NextResponse.json({
      success: true,
      data: validationResult,
    });
  } catch (error) {
    console.error('Error validating migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate migration',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/validate?job_id=<id>
 * Get validation results
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

    const results = await getValidationResults(parseInt(jobId));

    if (!results) {
      return NextResponse.json(
        { success: false, error: 'Validation results not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error fetching validation results:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch validation results',
      },
      { status: 500 }
    );
  }
}
