import { Pool } from 'pg';
import {
  getOdooPool,
  getConnectionConfig,
  executeQuery,
  getConfigPool,
} from '../database/connection';
import { EE_MODULES, EE_TABLES } from '../odoo/ee-modules';

export interface ValidationCheck {
  check_name: string;
  check_type: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  records_found: number;
}

export interface ValidationResult {
  overall_status: 'pass' | 'fail' | 'warning';
  checks: ValidationCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Validate staging database after migration
 */
export async function validateMigration(
  jobId: number,
  stagingConnectionId: number
): Promise<ValidationResult> {
  const stagingConfig = await getConnectionConfig(stagingConnectionId);
  const stagingPool = getOdooPool(`staging_${stagingConnectionId}`, stagingConfig);

  const checks: ValidationCheck[] = [];

  // Check 1: No EE modules installed
  const eeModulesCheck = await checkEEModules(stagingPool);
  checks.push(eeModulesCheck);

  // Check 2: No EE tables remain
  const eeTablesCheck = await checkEETables(stagingPool);
  checks.push(eeTablesCheck);

  // Check 3: No orphaned foreign keys
  const orphanedFKCheck = await checkOrphanedForeignKeys(stagingPool);
  checks.push(orphanedFKCheck);

  // Check 4: No EE models in ir_model
  const eeModelsCheck = await checkEEModels(stagingPool);
  checks.push(eeModelsCheck);

  // Check 5: No EE views
  const eeViewsCheck = await checkEEViews(stagingPool);
  checks.push(eeViewsCheck);

  // Check 6: No EE actions
  const eeActionsCheck = await checkEEActions(stagingPool);
  checks.push(eeActionsCheck);

  // Check 7: No active EE cron jobs
  const eeCronsCheck = await checkEECrons(stagingPool);
  checks.push(eeCronsCheck);

  // Check 8: Database integrity
  const integrityCheck = await checkDatabaseIntegrity(stagingPool);
  checks.push(integrityCheck);

  // Save results
  await saveValidationResults(jobId, checks);

  // Calculate summary
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: checks.filter((c) => c.status === 'fail').length,
    warnings: checks.filter((c) => c.status === 'warning').length,
  };

  const overall_status =
    summary.failed > 0 ? 'fail' : summary.warnings > 0 ? 'warning' : 'pass';

  return {
    overall_status,
    checks,
    summary,
  };
}

/**
 * Check if any EE modules are still installed
 */
async function checkEEModules(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ name: string; state: string }>(
      pool,
      `SELECT name, state FROM ir_module_module 
       WHERE name = ANY($1) AND state != 'uninstalled'`,
      [EE_MODULES]
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'fail';
    const details =
      recordsFound === 0
        ? 'All Enterprise modules marked as uninstalled'
        : `Found ${recordsFound} Enterprise modules still installed: ${result
            .map((r) => r.name)
            .join(', ')}`;

    return {
      check_name: 'EE Modules Check',
      check_type: 'module_registry',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Modules Check',
      check_type: 'module_registry',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check if any EE tables still exist
 */
async function checkEETables(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ tablename: string }>(
      pool,
      `SELECT tablename FROM pg_tables 
       WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [EE_TABLES]
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'fail';
    const details =
      recordsFound === 0
        ? 'All Enterprise tables removed'
        : `Found ${recordsFound} Enterprise tables still exist: ${result
            .map((r) => r.tablename)
            .slice(0, 10)
            .join(', ')}${recordsFound > 10 ? '...' : ''}`;

    return {
      check_name: 'EE Tables Check',
      check_type: 'database_schema',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Tables Check',
      check_type: 'database_schema',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check for orphaned foreign keys
 */
async function checkOrphanedForeignKeys(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ constraint_name: string }>(
      pool,
      `SELECT tc.constraint_name
       FROM information_schema.table_constraints AS tc 
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' 
       AND tc.table_schema = 'public'
       AND ccu.table_name = ANY($1)`,
      [EE_TABLES]
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'warning';
    const details =
      recordsFound === 0
        ? 'No orphaned foreign key constraints found'
        : `Found ${recordsFound} foreign key constraints referencing dropped tables`;

    return {
      check_name: 'Orphaned Foreign Keys Check',
      check_type: 'database_integrity',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'Orphaned Foreign Keys Check',
      check_type: 'database_integrity',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check if EE models exist in ir_model
 */
async function checkEEModels(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ model: string }>(
      pool,
      `SELECT model FROM ir_model 
       WHERE modules LIKE ANY(ARRAY[${EE_MODULES.map((m) => `'%${m}%'`).join(', ')}])`
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'fail';
    const details =
      recordsFound === 0
        ? 'No Enterprise models in ir_model'
        : `Found ${recordsFound} Enterprise models still registered`;

    return {
      check_name: 'EE Models Check',
      check_type: 'model_registry',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Models Check',
      check_type: 'model_registry',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check for EE views
 */
async function checkEEViews(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ key: string }>(
      pool,
      `SELECT key FROM ir_ui_view 
       WHERE key LIKE '%enterprise%' 
       OR arch_db LIKE '%web_enterprise%'
       OR arch_db LIKE '%web_studio%'`
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'warning';
    const details =
      recordsFound === 0
        ? 'No Enterprise views found'
        : `Found ${recordsFound} views with Enterprise references`;

    return {
      check_name: 'EE Views Check',
      check_type: 'ui_elements',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Views Check',
      check_type: 'ui_elements',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check for EE actions
 */
async function checkEEActions(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ name: string }>(
      pool,
      `SELECT name FROM ir_actions_act_window 
       WHERE res_model LIKE '%enterprise%'`
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'warning';
    const details =
      recordsFound === 0
        ? 'No Enterprise actions found'
        : `Found ${recordsFound} actions with Enterprise references`;

    return {
      check_name: 'EE Actions Check',
      check_type: 'ui_elements',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Actions Check',
      check_type: 'ui_elements',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check for active EE cron jobs
 */
async function checkEECrons(pool: Pool): Promise<ValidationCheck> {
  try {
    const result = await executeQuery<{ name: string }>(
      pool,
      `SELECT cron.name FROM ir_cron cron
       JOIN ir_model model ON cron.model_id = model.id
       WHERE cron.active = true 
       AND model.modules LIKE ANY(ARRAY[${EE_MODULES.map((m) => `'%${m}%'`).join(', ')}])`
    );

    const recordsFound = result.length;
    const status = recordsFound === 0 ? 'pass' : 'warning';
    const details =
      recordsFound === 0
        ? 'No active Enterprise cron jobs'
        : `Found ${recordsFound} active cron jobs for Enterprise modules`;

    return {
      check_name: 'EE Cron Jobs Check',
      check_type: 'scheduled_actions',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'EE Cron Jobs Check',
      check_type: 'scheduled_actions',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Check database integrity
 */
async function checkDatabaseIntegrity(pool: Pool): Promise<ValidationCheck> {
  try {
    // Check for table and index bloat
    const result = await executeQuery<{ count: string }>(
      pool,
      `SELECT COUNT(*) as count FROM pg_stat_user_tables WHERE schemaname = 'public'`
    );

    const recordsFound = parseInt(result[0].count);
    const status = recordsFound > 0 ? 'pass' : 'fail';
    const details =
      status === 'pass'
        ? `Database contains ${recordsFound} tables`
        : 'Database integrity check failed';

    return {
      check_name: 'Database Integrity Check',
      check_type: 'database_health',
      status,
      details,
      records_found: recordsFound,
    };
  } catch (error) {
    return {
      check_name: 'Database Integrity Check',
      check_type: 'database_health',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Check failed',
      records_found: -1,
    };
  }
}

/**
 * Save validation results to database
 */
async function saveValidationResults(
  jobId: number,
  checks: ValidationCheck[]
): Promise<void> {
  const configPool = getConfigPool();

  for (const check of checks) {
    await executeQuery(
      configPool,
      `INSERT INTO validation_results 
       (job_id, check_name, check_type, status, details, records_found)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        jobId,
        check.check_name,
        check.check_type,
        check.status,
        check.details,
        check.records_found,
      ]
    );
  }
}

/**
 * Get validation results for a job
 */
export async function getValidationResults(
  jobId: number
): Promise<ValidationResult | null> {
  const configPool = getConfigPool();

  const checks = await executeQuery<ValidationCheck>(
    configPool,
    'SELECT check_name, check_type, status, details, records_found FROM validation_results WHERE job_id = $1 ORDER BY id',
    [jobId]
  );

  if (checks.length === 0) {
    return null;
  }

  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: checks.filter((c) => c.status === 'fail').length,
    warnings: checks.filter((c) => c.status === 'warning').length,
  };

  const overall_status =
    summary.failed > 0 ? 'fail' : summary.warnings > 0 ? 'warning' : 'pass';

  return {
    overall_status,
    checks,
    summary,
  };
}
