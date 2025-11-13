import {
  getOdooPool,
  getConnectionConfig,
  executeQuery,
  getConfigPool,
} from '../database/connection';
import { EE_MODULES, EE_TABLE_PATTERNS, EE_TABLES } from '../odoo/ee-modules';

export interface AnalysisResult {
  ee_modules_found: Array<{
    name: string;
    state: string;
    latest_version: string;
  }>;
  ee_tables_found: Array<{
    table_name: string;
    row_count: number;
    size_mb: string | number;
  }>;
  foreign_key_dependencies: Array<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    constraint_name: string;
  }>;
  record_counts: Record<string, number>;
  estimated_export_size_mb: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
}

/**
 * Analyze source EE database for migration
 */
export async function analyzeSourceDatabase(
  sourceConnectionId: number
): Promise<AnalysisResult> {
  const sourceConfig = await getConnectionConfig(sourceConnectionId);
  const sourcePool = getOdooPool(`source_${sourceConnectionId}`, sourceConfig);

  const warnings: string[] = [];

  // 1. Detect installed EE modules
  const eeModulesQuery = `
    SELECT name, state, latest_version 
    FROM ir_module_module 
    WHERE state = 'installed' 
    AND name = ANY($1)
    ORDER BY name
  `;

  const eeModules = await executeQuery<{
    name: string;
    state: string;
    latest_version: string;
  }>(sourcePool, eeModulesQuery, [EE_MODULES]);

  if (eeModules.length === 0) {
    warnings.push('No Enterprise Edition modules found. Database may already be CE.');
  }

  // 2. Find all EE tables
  const eeTablesQuery = `
    SELECT 
      tablename as table_name,
      pg_total_relation_size(schemaname||'.'||tablename) / (1024*1024)::numeric as size_mb
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND (
      tablename = ANY($1)
      OR ${EE_TABLE_PATTERNS.map((_, i) => `tablename LIKE $${i + 2}`).join(' OR ')}
    )
    ORDER BY tablename
  `;

  const eeTables = await executeQuery<{
    table_name: string;
    size_mb: string | number;
  }>(sourcePool, eeTablesQuery, [EE_TABLES, ...EE_TABLE_PATTERNS]);

  // 3. Get row counts for each table
  const recordCounts: Record<string, number> = {};
  const tablesWithCounts: Array<{
    table_name: string;
    row_count: number;
    size_mb: string | number;
  }> = [];

  for (const table of eeTables) {
    try {
      const countResult = await executeQuery<{ count: string }>(
        sourcePool,
        `SELECT COUNT(*) as count FROM ${table.table_name}`
      );
      const count = parseInt(countResult[0].count);
      recordCounts[table.table_name] = count;
      tablesWithCounts.push({
        ...table,
        row_count: count,
      });

      if (count > 100000) {
        warnings.push(
          `Table ${table.table_name} has ${count.toLocaleString()} records - export may take significant time`
        );
      }
    } catch {
      recordCounts[table.table_name] = 0;
      tablesWithCounts.push({
        ...table,
        row_count: 0,
      });
    }
  }

  // 4. Find foreign key dependencies
  const fkQuery = `
    SELECT 
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (
      ccu.table_name = ANY($1)
      OR tc.table_name = ANY($1)
    )
    ORDER BY tc.table_name, kcu.column_name
  `;

  const foreignKeys = await executeQuery<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    constraint_name: string;
  }>(sourcePool, fkQuery, [eeTables.map((t) => t.table_name)]);

  // Count foreign keys pointing TO EE tables from CE tables
  const dangerousFKs = foreignKeys.filter((fk) =>
    eeTables.some((t) => t.table_name === fk.foreign_table_name)
  ).filter((fk) =>
    !eeTables.some((t) => t.table_name === fk.table_name)
  );

  if (dangerousFKs.length > 0) {
    warnings.push(
      `Found ${dangerousFKs.length} foreign key constraints from CE tables pointing to EE tables - these will need cleanup`
    );
  }

  // 5. Calculate estimated export size
  const estimatedExportSize = tablesWithCounts.reduce(
    (sum, table) => sum + parseFloat(String(table.size_mb)),
    0
  );

  // 6. Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);

  if (dangerousFKs.length > 10 || totalRecords > 1000000) {
    riskLevel = 'critical';
  } else if (dangerousFKs.length > 5 || totalRecords > 500000) {
    riskLevel = 'high';
  } else if (dangerousFKs.length > 0 || totalRecords > 100000) {
    riskLevel = 'medium';
  }

  // 7. Check for active EE cron jobs
  try {
    const activeCronsQuery = `
      SELECT COUNT(*) as count
      FROM ir_cron
      WHERE active = true
      AND model IN (
        SELECT model FROM ir_model WHERE modules LIKE '%enterprise%'
      )
    `;
    const activeCrons = await executeQuery<{ count: string }>(
      sourcePool,
      activeCronsQuery
    );
    const cronCount = parseInt(activeCrons[0].count);
    if (cronCount > 0) {
      warnings.push(`Found ${cronCount} active cron jobs for EE modules`);
    }
  } catch {
    // Ignore if query fails
  }

  return {
    ee_modules_found: eeModules,
    ee_tables_found: tablesWithCounts,
    foreign_key_dependencies: foreignKeys,
    record_counts: recordCounts,
    estimated_export_size_mb: estimatedExportSize,
    risk_level: riskLevel,
    warnings,
  };
}

/**
 * Save analysis results to database
 */
export async function saveAnalysisResults(
  jobId: number,
  results: AnalysisResult
): Promise<void> {
  const configPool = getConfigPool();

  await executeQuery(
    configPool,
    `INSERT INTO analysis_results 
     (job_id, ee_modules_found, ee_tables_found, foreign_key_dependencies, 
      record_counts, estimated_export_size_mb, risk_level, warnings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      jobId,
      JSON.stringify(results.ee_modules_found),
      JSON.stringify(results.ee_tables_found),
      JSON.stringify(results.foreign_key_dependencies),
      JSON.stringify(results.record_counts),
      results.estimated_export_size_mb,
      results.risk_level,
      JSON.stringify(results.warnings),
    ]
  );
}

/**
 * Get analysis results for a job
 */
export async function getAnalysisResults(
  jobId: number
): Promise<AnalysisResult | null> {
  const configPool = getConfigPool();

  const results = await executeQuery<{
    ee_modules_found: string;
    ee_tables_found: string;
    foreign_key_dependencies: string;
    record_counts: string;
    estimated_export_size_mb: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    warnings: string;
  }>(
    configPool,
    'SELECT * FROM analysis_results WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
    [jobId]
  );

  if (results.length === 0) {
    return null;
  }

  const result = results[0];
  return {
    ee_modules_found: JSON.parse(result.ee_modules_found),
    ee_tables_found: JSON.parse(result.ee_tables_found),
    foreign_key_dependencies: JSON.parse(result.foreign_key_dependencies),
    record_counts: JSON.parse(result.record_counts),
    estimated_export_size_mb: result.estimated_export_size_mb,
    risk_level: result.risk_level,
    warnings: JSON.parse(result.warnings),
  };
}
