import { Pool, PoolClient } from 'pg';
import {
  getOdooPool,
  getConnectionConfig,
  executeQuery,
  getConfigPool,
  getClient,
} from '../database/connection';
import { EE_MODULES, EE_TABLES } from '../odoo/ee-modules';
import { AnalysisResult } from './analyzer';

export interface MigrationStep {
  step_number: number;
  step_name: string;
  sql_executed: string;
  rows_affected?: number;
  execution_time_ms?: number;
}

export interface MigrationResult {
  success: boolean;
  steps: MigrationStep[];
  errors: string[];
  dry_run: boolean;
}

/**
 * Log migration step
 */
async function logMigrationStep(
  jobId: number,
  step: MigrationStep,
  status: 'running' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  const configPool = getConfigPool();

  await executeQuery(
    configPool,
    `INSERT INTO migration_steps_log 
     (job_id, step_number, step_name, status, sql_executed, rows_affected, execution_time_ms, error_message, started_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      jobId,
      step.step_number,
      step.step_name,
      status,
      step.sql_executed,
      step.rows_affected || 0,
      step.execution_time_ms || 0,
      error || null,
      new Date(),
      status === 'completed' || status === 'failed' ? new Date() : null,
    ]
  );
}

/**
 * Execute migration step with timing
 */
async function executeStep(
  client: PoolClient,
  step: MigrationStep,
  dryRun: boolean
): Promise<{ rows_affected: number; execution_time_ms: number }> {
  if (dryRun) {
    return { rows_affected: 0, execution_time_ms: 0 };
  }

  const startTime = Date.now();
  const result = await client.query(step.sql_executed);
  const executionTime = Date.now() - startTime;

  return {
    rows_affected: result.rowCount || 0,
    execution_time_ms: executionTime,
  };
}

/**
 * Generate migration steps based on analysis
 */
export async function generateMigrationSteps(
  analysisResult: AnalysisResult
): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];
  let stepNumber = 1;

  // Step 1: Disable all EE cron jobs
  const eeModuleList = analysisResult.ee_modules_found.map((m) => m.name);
  if (eeModuleList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Disable Enterprise Edition cron jobs',
      sql_executed: `
UPDATE ir_cron SET active = false 
WHERE model IN (
  SELECT model FROM ir_model 
  WHERE modules LIKE ANY(ARRAY[${eeModuleList.map((m) => `'%${m}%'`).join(', ')}])
);
      `.trim(),
    });
  }

  // Step 2: Disable automated actions
  if (eeModuleList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Disable Enterprise Edition automated actions',
      sql_executed: `
UPDATE base_automation SET active = false 
WHERE model_id IN (
  SELECT id FROM ir_model 
  WHERE modules LIKE ANY(ARRAY[${eeModuleList.map((m) => `'%${m}%'`).join(', ')}])
);
      `.trim(),
    });
  }

  // Step 3: Mark EE modules as uninstalled
  if (eeModuleList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Mark Enterprise modules as uninstalled',
      sql_executed: `
UPDATE ir_module_module 
SET state = 'uninstalled', latest_version = NULL 
WHERE name IN (${eeModuleList.map((m) => `'${m}'`).join(', ')});
      `.trim(),
    });
  }

  // Step 4: Remove EE module dependencies
  if (eeModuleList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Remove Enterprise module dependencies',
      sql_executed: `
DELETE FROM ir_module_module_dependency 
WHERE module_id IN (
  SELECT id FROM ir_module_module WHERE name IN (${eeModuleList.map((m) => `'${m}'`).join(', ')})
);
      `.trim(),
    });
  }

  // Step 5: Remove EE views
  steps.push({
    step_number: stepNumber++,
    step_name: 'Remove Enterprise Edition views',
    sql_executed: `
DELETE FROM ir_ui_view 
WHERE key LIKE '%enterprise%' 
OR arch_db LIKE '%web_enterprise%'
OR arch_db LIKE '%web_studio%';
    `.trim(),
  });

  // Step 6: Remove EE menu items
  const eeTableList = analysisResult.ee_tables_found.map((t) => t.table_name);
  if (eeTableList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Remove Enterprise Edition menu items',
      sql_executed: `
DELETE FROM ir_ui_menu 
WHERE action LIKE 'ir.actions.act_window,%';
      `.trim(),
    });
  }

  // Step 7: Remove EE actions
  steps.push({
    step_number: stepNumber++,
    step_name: 'Remove Enterprise Edition actions',
    sql_executed: `
DELETE FROM ir_actions_act_window 
WHERE res_model LIKE '%enterprise%';
    `.trim(),
  });

  // Step 8: Drop foreign key constraints
  for (const fk of analysisResult.foreign_key_dependencies) {
    // Only drop FKs that reference EE tables
    if (eeTableList.includes(fk.foreign_table_name)) {
      steps.push({
        step_number: stepNumber++,
        step_name: `Drop FK constraint ${fk.constraint_name}`,
        sql_executed: `ALTER TABLE ${fk.table_name} DROP CONSTRAINT IF EXISTS ${fk.constraint_name} CASCADE;`,
      });
    }
  }

  // Step 9: Drop EE tables in reverse dependency order
  // Sort tables by dependencies (tables with no FKs first)
  const tablesToDrop = [...eeTableList];
  for (const table of tablesToDrop) {
    steps.push({
      step_number: stepNumber++,
      step_name: `Drop table ${table}`,
      sql_executed: `DROP TABLE IF EXISTS ${table} CASCADE;`,
    });
  }

  // Step 10: Clean ir_model_data
  steps.push({
    step_number: stepNumber++,
    step_name: 'Clean ir_model_data for removed tables',
    sql_executed: `
DELETE FROM ir_model_data 
WHERE model IN (${eeTableList.map((t) => `'${t}'`).join(', ')});
    `.trim(),
  });

  // Step 11: Remove EE models from ir_model
  if (eeModuleList.length > 0) {
    steps.push({
      step_number: stepNumber++,
      step_name: 'Remove Enterprise Edition models',
      sql_executed: `
DELETE FROM ir_model 
WHERE modules LIKE ANY(ARRAY[${eeModuleList.map((m) => `'%${m}%'`).join(', ')}]);
      `.trim(),
    });
  }

  // Step 12: Vacuum and analyze
  steps.push({
    step_number: stepNumber++,
    step_name: 'Vacuum and analyze database',
    sql_executed: 'VACUUM ANALYZE;',
  });

  return steps;
}

/**
 * Execute migration on staging database
 */
export async function executeMigration(
  jobId: number,
  stagingConnectionId: number,
  analysisResult: AnalysisResult,
  dryRun: boolean = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    steps: [],
    errors: [],
    dry_run: dryRun,
  };

  try {
    // Generate migration steps
    const steps = await generateMigrationSteps(analysisResult);

    // Get staging database connection
    const stagingConfig = await getConnectionConfig(stagingConnectionId);
    const stagingPool = getOdooPool(`staging_${stagingConnectionId}`, stagingConfig);

    if (dryRun) {
      // In dry-run mode, just return the steps without executing
      result.steps = steps;
      result.success = true;
      return result;
    }

    // Execute steps in transaction
    const client = await getClient(stagingPool);

    try {
      await client.query('BEGIN');

      for (const step of steps) {
        try {
          await logMigrationStep(jobId, step, 'running');

          const { rows_affected, execution_time_ms } = await executeStep(
            client,
            step,
            dryRun
          );

          step.rows_affected = rows_affected;
          step.execution_time_ms = execution_time_ms;

          await logMigrationStep(jobId, step, 'completed');
          result.steps.push(step);
        } catch (stepError) {
          const errorMessage =
            stepError instanceof Error ? stepError.message : 'Unknown error';
          result.errors.push(`Step ${step.step_number} failed: ${errorMessage}`);
          await logMigrationStep(jobId, step, 'failed', errorMessage);
          throw stepError;
        }
      }

      await client.query('COMMIT');
      result.success = true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : 'Migration failed'
    );
  }

  return result;
}

/**
 * Get migration steps log for a job
 */
export async function getMigrationStepsLog(jobId: number): Promise<
  Array<{
    id: number;
    step_number: number;
    step_name: string;
    status: string;
    sql_executed: string;
    rows_affected: number;
    execution_time_ms: number;
    error_message: string | null;
    started_at: Date;
    completed_at: Date | null;
  }>
> {
  const configPool = getConfigPool();
  return executeQuery(
    configPool,
    'SELECT * FROM migration_steps_log WHERE job_id = $1 ORDER BY step_number',
    [jobId]
  );
}
