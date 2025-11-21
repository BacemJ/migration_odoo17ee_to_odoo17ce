import { Pool } from 'pg';
import scanTables from "./scan_tables";

// Type definition matching entries in scan_tables
export interface TableScanDefinition {
  full_compatible_with_odoo_17_CE: boolean;
  can_have_incompatible_records_in_columns: boolean;
  incompatibility_detection_method: string | null;
  have_business_data: boolean;
  table_role: 'system' | 'configuration' | 'business';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  migration_action: string;
  notes: string;
}

// Result of incompatibility detection for a single table
export interface IncompatibilityResult {
  tableName: string;
  totalRecords: number;
  incompatibleRecords: number;
  percentageIncompatible: number;
  hasDetectionMethod: boolean;
  error?: string;
}

// Get scan tables data
export function getScanTables(): Record<string, TableScanDefinition> {
  return scanTables as Record<string, TableScanDefinition>;
}

// Get definition by fully qualified table name
export function getScanTable(tableName: string): TableScanDefinition | undefined {
  return getScanTables()[tableName];
}

// List tables that can have incompatible records at column level
export function listColumnLevelIncompatibilityTables(): string[] {
  return Object.entries(getScanTables())
    .filter((entry) => entry[1].can_have_incompatible_records_in_columns)
    .map((entry) => entry[0]);
}

/**
 * Execute incompatibility detection queries for tables and return statistics
 * @param pool PostgreSQL connection pool to the source database
 * @param tableNames Optional array of specific tables to check. If not provided, checks all tables with detection methods
 * @returns Array of incompatibility results per table
 */
export async function executeIncompatibilityDetection(
  pool: Pool,
  tableNames?: string[]
): Promise<IncompatibilityResult[]> {
  const allScanTables = getScanTables();
  const tablesToCheck = tableNames || Object.keys(allScanTables);
  
  const results: IncompatibilityResult[] = [];

  for (const fullTableName of tablesToCheck) {
    const definition = allScanTables[fullTableName];
    
    if (!definition) {
      continue;
    }

    const result: IncompatibilityResult = {
      tableName: fullTableName,
      totalRecords: 0,
      incompatibleRecords: 0,
      percentageIncompatible: 0,
      hasDetectionMethod: !!definition.incompatibility_detection_method,
    };

    try {
      // Extract just the table name without schema prefix
      const tableNameOnly = fullTableName.replace('public.', '');

      // Get total record count
      const totalQuery = `SELECT COUNT(*) as count FROM ${tableNameOnly}`;
      const totalResult = await pool.query(totalQuery);
      result.totalRecords = parseInt(totalResult.rows[0].count, 10);

      // If there's a detection method, execute it to count incompatible records
      if (definition.incompatibility_detection_method) {
        // Wrap the detection query to count results
        const countQuery = `SELECT COUNT(*) as count FROM (${definition.incompatibility_detection_method}) AS incompatible_subset`;
        const incompatibleResult = await pool.query(countQuery);
        result.incompatibleRecords = parseInt(incompatibleResult.rows[0].count, 10);
        
        // Calculate percentage
        if (result.totalRecords > 0) {
          result.percentageIncompatible = (result.incompatibleRecords / result.totalRecords) * 100;
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error during detection';
      console.error(`Error analyzing table ${fullTableName}:`, error);
    }

    results.push(result);
  }

  return results;
}

/**
 * Execute detection for a single table
 * @param pool PostgreSQL connection pool
 * @param tableName Fully qualified table name (e.g., 'public.ir_module_module')
 * @returns Incompatibility result for the table
 */
export async function executeTableDetection(
  pool: Pool,
  tableName: string
): Promise<IncompatibilityResult> {
  const results = await executeIncompatibilityDetection(pool, [tableName]);
  return results[0];
}

/**
 * Get a summary report of all incompatibility detections
 * @param pool PostgreSQL connection pool
 * @returns Summary statistics across all tables
 */
export async function getIncompatibilitySummary(pool: Pool): Promise<{
  totalTables: number;
  tablesWithDetectionMethods: number;
  totalRecordsScanned: number;
  totalIncompatibleRecords: number;
  overallPercentageIncompatible: number;
  byRiskLevel: Record<string, { tables: number; incompatibleRecords: number }>;
  results: IncompatibilityResult[];
}> {
  const results = await executeIncompatibilityDetection(pool);
  const allScanTables = getScanTables();
  
  const summary = {
    totalTables: results.length,
    tablesWithDetectionMethods: results.filter(r => r.hasDetectionMethod).length,
    totalRecordsScanned: results.reduce((sum, r) => sum + r.totalRecords, 0),
    totalIncompatibleRecords: results.reduce((sum, r) => sum + r.incompatibleRecords, 0),
    overallPercentageIncompatible: 0,
    byRiskLevel: {} as Record<string, { tables: number; incompatibleRecords: number }>,
    results,
  };

  // Calculate overall percentage
  if (summary.totalRecordsScanned > 0) {
    summary.overallPercentageIncompatible = 
      (summary.totalIncompatibleRecords / summary.totalRecordsScanned) * 100;
  }

  // Group by risk level
  for (const result of results) {
    const definition = allScanTables[result.tableName];
    if (definition) {
      const riskLevel = definition.risk_level;
      if (!summary.byRiskLevel[riskLevel]) {
        summary.byRiskLevel[riskLevel] = { tables: 0, incompatibleRecords: 0 };
      }
      summary.byRiskLevel[riskLevel].tables++;
      summary.byRiskLevel[riskLevel].incompatibleRecords += result.incompatibleRecords;
    }
  }

  return summary;
}


