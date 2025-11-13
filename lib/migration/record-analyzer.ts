import { Pool } from 'pg';
import { executeQuery } from '../database/connection';

/**
 * Record compatibility analysis result
 */
export interface RecordCompatibilityResult {
  tableName: string;
  category: 'compatible_diff' | 'incompatible_diff';
  totalRecords: number;
  ceCompatibleRecords: number;
  eeOnlyRecords: number;
  percentageCompatible: number;
  missingColumns?: string[];
  sampleIncompatibleRecords?: Record<string, unknown>[];
}

export interface DetailedAnalysisResult {
  compatibleDiffTables: RecordCompatibilityResult[];
  incompatibleDiffTables: RecordCompatibilityResult[];
  summary: {
    totalTablesAnalyzed: number;
    totalCompatibleTables: number;
    totalIncompatibleTables: number;
    totalRecords: number;
    ceCompatibleRecords: number;
    eeOnlyRecords: number;
  };
}

/**
 * Get columns that exist in source but not in target
 */
async function getMissingColumnsInTarget(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string
): Promise<string[]> {
  const sourceColumnsQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const targetColumnsQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const sourceColumns = await executeQuery<{ column_name: string }>(
    sourcePool,
    sourceColumnsQuery,
    [tableName]
  );
  
  const targetColumns = await executeQuery<{ column_name: string }>(
    targetPool,
    targetColumnsQuery,
    [tableName]
  );
  
  const targetColumnNames = new Set(targetColumns.map(c => c.column_name));
  const missingColumns = sourceColumns
    .filter(c => !targetColumnNames.has(c.column_name))
    .map(c => c.column_name);
  
  return missingColumns;
}

/**
 * Get columns that have at least one non-null value in source
 */
async function getNonNullColumns(pool: Pool, tableName: string): Promise<string[]> {
  const columnsQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const columns = await executeQuery<{ column_name: string }>(pool, columnsQuery, [tableName]);
  
  if (columns.length === 0) {
    return [];
  }
  
  // Build dynamic query to check each column for non-null values
  const columnChecks = columns.map(col => 
    `COUNT("${col.column_name}") > 0 as "${col.column_name}_has_data"`
  ).join(', ');
  
  const query = `SELECT ${columnChecks} FROM "${tableName}"`;
  
  try {
    const result = await executeQuery<Record<string, boolean>>(pool, query);
    
    if (result.length === 0) {
      return [];
    }
    
    const nonNullColumns: string[] = [];
    const row = result[0];
    
    for (const col of columns) {
      const checkField = `${col.column_name}_has_data`;
      if (row[checkField] === true) {
        nonNullColumns.push(col.column_name);
      }
    }
    
    return nonNullColumns;
  } catch (error) {
    console.error(`Error checking non-null columns for ${tableName}:`, error);
    return columns.map(c => c.column_name);
  }
}

/**
 * Analyze records in tables with compatible differences
 * Checks how many records can be migrated vs. how many have differences
 */
async function analyzeCompatibleDiffTable(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string,
  sourceRecordCount: number
): Promise<RecordCompatibilityResult> {
  try {
    const targetRecordCount = await executeQuery<{ count: string }>(
      targetPool,
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    const targetCount = parseInt(targetRecordCount[0].count);
    
    // For compatible tables, all source records can potentially be migrated
    // CE compatible = records that already exist in target with same values
    // EE only = records that differ or don't exist in target yet
    
    const ceCompatibleRecords = Math.min(sourceRecordCount, targetCount);
    const eeOnlyRecords = sourceRecordCount - ceCompatibleRecords;
    
    return {
      tableName,
      category: 'compatible_diff',
      totalRecords: sourceRecordCount,
      ceCompatibleRecords,
      eeOnlyRecords,
      percentageCompatible: (ceCompatibleRecords / sourceRecordCount) * 100,
      missingColumns: [],
    };
  } catch (error) {
    console.error(`Error analyzing compatible table ${tableName}:`, error);
    return {
      tableName,
      category: 'compatible_diff',
      totalRecords: sourceRecordCount,
      ceCompatibleRecords: 0,
      eeOnlyRecords: sourceRecordCount,
      percentageCompatible: 0,
      missingColumns: [],
    };
  }
}

/**
 * Analyze records in tables with incompatible differences
 * Identifies which records have data in EE-only columns
 */
async function analyzeIncompatibleDiffTable(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string,
  sourceRecordCount: number
): Promise<RecordCompatibilityResult> {
  try {
    const missingColumns = await getMissingColumnsInTarget(sourcePool, targetPool, tableName);
    const nonNullColumns = await getNonNullColumns(sourcePool, tableName);
    
    // Find which missing columns actually have non-null data
    const missingWithData = missingColumns.filter(col => nonNullColumns.includes(col));
    
    if (missingWithData.length === 0) {
      // All missing columns are null-only, so all records are CE compatible
      return {
        tableName,
        category: 'incompatible_diff',
        totalRecords: sourceRecordCount,
        ceCompatibleRecords: sourceRecordCount,
        eeOnlyRecords: 0,
        percentageCompatible: 100,
        missingColumns,
      };
    }
    
    // Count records that have non-null values in any EE-only column
    const conditions = missingWithData.map(col => `"${col}" IS NOT NULL`).join(' OR ');
    const eeOnlyQuery = `
      SELECT COUNT(*) as count 
      FROM "${tableName}" 
      WHERE ${conditions}
    `;
    
    const eeOnlyResult = await executeQuery<{ count: string }>(sourcePool, eeOnlyQuery);
    const eeOnlyRecords = parseInt(eeOnlyResult[0].count);
    const ceCompatibleRecords = sourceRecordCount - eeOnlyRecords;
    
    // Get sample of incompatible records (up to 5)
    const sampleQuery = `
      SELECT * 
      FROM "${tableName}" 
      WHERE ${conditions}
      LIMIT 5
    `;
    
    const sampleRecords = await executeQuery<Record<string, unknown>>(sourcePool, sampleQuery);
    
    return {
      tableName,
      category: 'incompatible_diff',
      totalRecords: sourceRecordCount,
      ceCompatibleRecords,
      eeOnlyRecords,
      percentageCompatible: (ceCompatibleRecords / sourceRecordCount) * 100,
      missingColumns,
      sampleIncompatibleRecords: sampleRecords,
    };
  } catch (error) {
    console.error(`Error analyzing incompatible table ${tableName}:`, error);
    return {
      tableName,
      category: 'incompatible_diff',
      totalRecords: sourceRecordCount,
      ceCompatibleRecords: 0,
      eeOnlyRecords: sourceRecordCount,
      percentageCompatible: 0,
      missingColumns: [],
    };
  }
}

/**
 * Analyze all tables with compatible and incompatible differences
 */
export async function analyzeRecordCompatibility(
  sourcePool: Pool,
  targetPool: Pool,
  compatibleTables: Array<{ tableName: string; sourceRecordCount: number }>,
  incompatibleTables: Array<{ tableName: string; sourceRecordCount: number }>
): Promise<DetailedAnalysisResult> {
  console.log('Starting detailed record compatibility analysis...');
  
  const compatibleDiffTables: RecordCompatibilityResult[] = [];
  const incompatibleDiffTables: RecordCompatibilityResult[] = [];
  
  // Analyze compatible diff tables
  for (const table of compatibleTables) {
    console.log(`Analyzing compatible table: ${table.tableName}`);
    const result = await analyzeCompatibleDiffTable(
      sourcePool,
      targetPool,
      table.tableName,
      table.sourceRecordCount
    );
    compatibleDiffTables.push(result);
  }
  
  // Analyze incompatible diff tables
  for (const table of incompatibleTables) {
    console.log(`Analyzing incompatible table: ${table.tableName}`);
    const result = await analyzeIncompatibleDiffTable(
      sourcePool,
      targetPool,
      table.tableName,
      table.sourceRecordCount
    );
    incompatibleDiffTables.push(result);
  }
  
  // Calculate summary
  const allResults = [...compatibleDiffTables, ...incompatibleDiffTables];
  const summary = {
    totalTablesAnalyzed: allResults.length,
    totalCompatibleTables: compatibleDiffTables.length,
    totalIncompatibleTables: incompatibleDiffTables.length,
    totalRecords: allResults.reduce((sum, r) => sum + r.totalRecords, 0),
    ceCompatibleRecords: allResults.reduce((sum, r) => sum + r.ceCompatibleRecords, 0),
    eeOnlyRecords: allResults.reduce((sum, r) => sum + r.eeOnlyRecords, 0),
  };
  
  console.log('Record compatibility analysis completed');
  console.log(`- Total tables analyzed: ${summary.totalTablesAnalyzed}`);
  console.log(`- Total records: ${summary.totalRecords}`);
  console.log(`- CE compatible records: ${summary.ceCompatibleRecords}`);
  console.log(`- EE only records: ${summary.eeOnlyRecords}`);
  
  return {
    compatibleDiffTables,
    incompatibleDiffTables,
    summary,
  };
}
