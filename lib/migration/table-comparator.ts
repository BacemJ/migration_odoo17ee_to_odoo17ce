import { Pool } from 'pg';
import { executeQuery } from '../database/connection';

/**
 * Table comparison categories
 */
export interface TableComparisonResult {
  // Total tables with data in source
  tablesWithData: number;
  
  // Tables that exist in source but not in target
  tablesMissingInTarget: number;
  
  // Tables with identical record counts in both databases
  tablesWithIdenticalRecords: number;
  
  // Tables with different records but target has all necessary fields
  tablesWithCompatibleDiff: number;
  
  // Tables with different records and target lacks necessary fields
  tablesWithIncompatibleDiff: number;
  
  // Detailed breakdown per table
  tableDetails: TableComparisonDetail[];
}

export interface TableComparisonDetail {
  tableName: string;
  category: 'missing_in_target' | 'identical_records' | 'compatible_diff' | 'incompatible_diff';
  sourceRecordCount: number;
  targetRecordCount?: number;
  missingColumns?: string[];
  nullOnlyColumns?: string[];
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
}

/**
 * Get all columns for a table
 */
async function getTableColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
  const query = `
    SELECT 
      column_name as "columnName",
      data_type as "dataType",
      is_nullable as "isNullable"
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  return executeQuery<ColumnInfo>(pool, query, [tableName]);
}

/**
 * Get columns that have at least one non-null value
 */
async function getNonNullColumns(pool: Pool, tableName: string): Promise<string[]> {
  const columns = await getTableColumns(pool, tableName);
  
  if (columns.length === 0) {
    return [];
  }
  
  // Build dynamic query to check each column for non-null values
  const columnChecks = columns.map(col => 
    `COUNT("${col.columnName}") > 0 as "${col.columnName}_has_data"`
  ).join(', ');
  
  const query = `SELECT ${columnChecks} FROM "${tableName}"`;
  
  try {
    const result = await executeQuery<Record<string, boolean>>(pool, query);
    
    if (result.length === 0) {
      return [];
    }
    
    // Filter columns that have at least one non-null value
    const nonNullColumns: string[] = [];
    const row = result[0];
    
    for (const col of columns) {
      const checkField = `${col.columnName}_has_data`;
      if (row[checkField] === true) {
        nonNullColumns.push(col.columnName);
      }
    }
    
    return nonNullColumns;
  } catch (error) {
    console.error(`Error checking non-null columns for ${tableName}:`, error);
    // Return all columns as fallback
    return columns.map(c => c.columnName);
  }
}

/**
 * Check if a table exists in the target database
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = $1
    ) as exists
  `;
  
  const result = await executeQuery<{ exists: boolean }>(pool, query, [tableName]);
  return result[0]?.exists || false;
}

/**
 * Get record count for a table
 */
async function getRecordCount(pool: Pool, tableName: string): Promise<number> {
  try {
    const query = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const result = await executeQuery<{ count: string }>(pool, query);
    return parseInt(result[0].count);
  } catch (error) {
    console.error(`Error counting records for ${tableName}:`, error);
    return 0;
  }
}

/**
 * Check if target table has all necessary columns from source
 */
async function checkSchemaCompatibility(
  sourceNonNullColumns: string[],
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string
): Promise<{ compatible: boolean; missingColumns: string[]; }> {
  // Get all columns from target
  const targetColumns = await getTableColumns(targetPool, tableName);
  const targetColumnNames = targetColumns.map(c => c.columnName);
  
  // Check which non-null source columns are missing in target
  const missingColumns = sourceNonNullColumns.filter(
    col => !targetColumnNames.includes(col)
  );
  
  return {
    compatible: missingColumns.length === 0,
    missingColumns
  };
}

/**
 * Check if all records are identical between source and target tables
 * Compares records one by one using non-null columns
 */
async function areRecordsIdentical(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string,
  nonNullColumns: string[]
): Promise<boolean> {
  try {
    // Build SELECT query with only non-null columns
    const columnsList = nonNullColumns.map(col => `"${col}"`).join(', ');
    const query = `SELECT ${columnsList} FROM "${tableName}" ORDER BY ${columnsList}`;

    // Fetch all records from both databases
    const sourceRecords = await executeQuery<Record<string, unknown>>(sourcePool, query);
    const targetRecords = await executeQuery<Record<string, unknown>>(targetPool, query);

    // Compare record by record
    if (sourceRecords.length !== targetRecords.length) {
      return false;
    }

    for (let i = 0; i < sourceRecords.length; i++) {
      const sourceRecord = sourceRecords[i];
      const targetRecord = targetRecords[i];

      // Compare each non-null column value
      for (const col of nonNullColumns) {
        const sourceValue = sourceRecord[col];
        const targetValue = targetRecord[col];

        // Convert to string for comparison to handle different types
        if (String(sourceValue) !== String(targetValue)) {
          return false; // Found a difference
        }
      }
    }

    return true; // All records are identical
  } catch (error) {
    console.error(`Error comparing records for ${tableName}:`, error);
    return false; // Assume not identical on error
  }
}

/**
 * Compare tables between source and target databases
 */
export async function compareTablesBetweenDatabases(
  sourcePool: Pool,
  targetPool: Pool
): Promise<TableComparisonResult> {
  console.log('Starting table comparison between databases...');
  
  // Get all tables with data from source database
  const tablesQuery = `
    SELECT 
      tablename as "tableName",
      schemaname as "schemaName"
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  
  const sourceTables = await executeQuery<{ tableName: string; schemaName: string }>(
    sourcePool,
    tablesQuery
  );
  
  console.log(`Found ${sourceTables.length} tables in source database`);
  
  const tableDetails: TableComparisonDetail[] = [];
  let tablesWithData = 0;
  let tablesMissingInTarget = 0;
  let tablesWithIdenticalRecords = 0;
  let tablesWithCompatibleDiff = 0;
  let tablesWithIncompatibleDiff = 0;
  
  // Process each table
  for (const table of sourceTables) {
    const tableName = table.tableName;
    
    try {
      // Check if table has data in source
      const sourceCount = await getRecordCount(sourcePool, tableName);
      
      if (sourceCount === 0) {
        // Skip tables with no data
        continue;
      }
      
      tablesWithData++;
      
      // Check if table exists in target
      const exists = await tableExists(targetPool, tableName);
      
      if (!exists) {
        tablesMissingInTarget++;
        tableDetails.push({
          tableName,
          category: 'missing_in_target',
          sourceRecordCount: sourceCount,
        });
        continue;
      }
      
      // Table exists in target, get record count
      const targetCount = await getRecordCount(targetPool, tableName);
      const sourceNonNullColumns = await getNonNullColumns(sourcePool, tableName);
      // Check schema compatibility first
      const compatibility = await checkSchemaCompatibility(
        sourceNonNullColumns,
        sourcePool,
        targetPool,
        tableName
      );
      
      if (!compatibility.compatible) {
        // Target lacks necessary columns
        tablesWithIncompatibleDiff++;
        tableDetails.push({
          tableName,
          category: 'incompatible_diff',
          sourceRecordCount: sourceCount,
          targetRecordCount: targetCount,
          missingColumns: compatibility.missingColumns,
        });
        continue;
      }

      // Schema is compatible, now check records
      if (sourceCount === targetCount) {
        // Counts match, verify all records are identical
        
        const recordsIdentical = await areRecordsIdentical(
          sourcePool,
          targetPool,
          tableName,
          sourceNonNullColumns
        );

        if (recordsIdentical) {
          tablesWithIdenticalRecords++;
          tableDetails.push({
            tableName,
            category: 'identical_records',
            sourceRecordCount: sourceCount,
            targetRecordCount: targetCount,
          });
          continue;
        }
      }

      // Records differ but schema is compatible
      tablesWithCompatibleDiff++;
      tableDetails.push({
        tableName,
        category: 'compatible_diff',
        sourceRecordCount: sourceCount,
        targetRecordCount: targetCount,
        missingColumns: [],
      });      
    } catch (error) {
      console.error(`Error processing table ${tableName}:`, error);
    }
  }
  
  console.log('Table comparison completed');
  console.log(`- Tables with data: ${tablesWithData}`);
  console.log(`- Missing in target: ${tablesMissingInTarget}`);
  console.log(`- Identical records: ${tablesWithIdenticalRecords}`);
  console.log(`- Compatible differences: ${tablesWithCompatibleDiff}`);
  console.log(`- Incompatible differences: ${tablesWithIncompatibleDiff}`);
  
  return {
    tablesWithData,
    tablesMissingInTarget,
    tablesWithIdenticalRecords,
    tablesWithCompatibleDiff,
    tablesWithIncompatibleDiff,
    tableDetails,
  };
}
