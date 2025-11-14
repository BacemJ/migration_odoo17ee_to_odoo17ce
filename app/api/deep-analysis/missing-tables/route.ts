import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getOdooPool, getConnectionConfig, executeQuery } from '@/lib/database/connection';

interface TableDataType {
  category: 'business_data' | 'system_configuration' | 'application_configuration' | 'technical';
  description: string;
}

// Classification of Odoo tables by data type
const TABLE_DATA_TYPES: Record<string, TableDataType> = {
  // Business Data
  'helpdesk_team': { category: 'business_data', description: 'Helpdesk teams and configuration' },
  'helpdesk_ticket': { category: 'business_data', description: 'Customer support tickets' },
  'helpdesk_stage': { category: 'business_data', description: 'Ticket workflow stages' },
  'helpdesk_sla': { category: 'business_data', description: 'Service level agreements' },
  'helpdesk_tag': { category: 'business_data', description: 'Ticket categorization tags' },
  
  'documents_document': { category: 'business_data', description: 'Document management files' },
  'documents_folder': { category: 'business_data', description: 'Document folders structure' },
  'documents_tag': { category: 'business_data', description: 'Document classification tags' },
  'documents_facet': { category: 'business_data', description: 'Document facets' },
  'documents_share': { category: 'business_data', description: 'Document sharing links' },
  'documents_workflow_rule': { category: 'application_configuration', description: 'Document automation rules' },
  
  'planning_slot': { category: 'business_data', description: 'Employee planning schedules' },
  'planning_role': { category: 'business_data', description: 'Planning roles' },
  'planning_template': { category: 'business_data', description: 'Planning templates' },
  'planning_recurrency': { category: 'application_configuration', description: 'Recurring planning patterns' },
  
  'sign_request': { category: 'business_data', description: 'Electronic signature requests' },
  'sign_template': { category: 'business_data', description: 'Signature templates' },
  'sign_item': { category: 'business_data', description: 'Signature items' },
  'sign_request_item': { category: 'business_data', description: 'Signature request items' },
  
  'approval_request': { category: 'business_data', description: 'Approval requests' },
  'approval_category': { category: 'application_configuration', description: 'Approval categories' },
  'approval_approver': { category: 'business_data', description: 'Approval workflow participants' },
  
  'quality_point': { category: 'application_configuration', description: 'Quality control checkpoints' },
  'quality_check': { category: 'business_data', description: 'Quality inspection records' },
  'quality_alert': { category: 'business_data', description: 'Quality alerts and issues' },
  
  'sale_subscription': { category: 'business_data', description: 'Recurring subscriptions' },
  'sale_subscription_template': { category: 'application_configuration', description: 'Subscription templates' },
  'sale_subscription_line': { category: 'business_data', description: 'Subscription line items' },
  
  // IoT and VoIP
  'iot_box': { category: 'system_configuration', description: 'IoT box devices' },
  'iot_device': { category: 'system_configuration', description: 'Connected IoT devices' },
  'voip_configurator': { category: 'system_configuration', description: 'VoIP configuration' },
  'voip_phonecall': { category: 'business_data', description: 'VoIP call records' },
};

// Fallback classification based on table name patterns
function classifyTable(tableName: string): TableDataType {
  if (TABLE_DATA_TYPES[tableName]) {
    return TABLE_DATA_TYPES[tableName];
  }
  
  // Pattern-based classification
  if (tableName.includes('_config') || tableName.includes('_settings')) {
    return { category: 'system_configuration', description: 'System configuration table' };
  }
  
  if (tableName.includes('_wizard') || tableName.includes('_import')) {
    return { category: 'technical', description: 'Temporary/wizard table' };
  }
  
  if (tableName.includes('_rel') || tableName.endsWith('_rel')) {
    return { category: 'technical', description: 'Many-to-many relation table' };
  }
  
  if (tableName.includes('_template') || tableName.includes('_stage') || tableName.includes('_category')) {
    return { category: 'application_configuration', description: 'Application configuration' };
  }
  
  // Default to business data for enterprise modules
  return { category: 'business_data', description: 'Business data table' };
}

/**
 * Get sample records from a table with only non-null columns
 */
async function getSampleRecords(pool: Pool, tableName: string, limit: number = 20) {
  try {
    // First, get all columns
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
      ORDER BY ordinal_position
    `;
    
    const columns = await executeQuery<{ column_name: string }>(pool, columnsQuery, [tableName]);
    
    if (columns.length === 0) {
      return { columns: [], records: [] };
    }
    
    const columnNames = columns.map(c => c.column_name);
    
    // Get sample records
    const dataQuery = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
    const records = await executeQuery<Record<string, unknown>>(pool, dataQuery);

    if (records.length === 0) {
      return { columns: columnNames, records: [] };
    }
    
    // Identify columns that have at least one non-null value in the sample
    const nonNullColumns = columnNames.filter(col => {
      return records.some(record => record[col] !== null && record[col] !== undefined);
    });
    
    // Filter records to only include non-null columns
    const filteredRecords = records.map(record => {
      const filtered: Record<string, unknown> = {};
      nonNullColumns.forEach(col => {
        filtered[col] = record[col];
      });
      return filtered;
    });
    
    return {
      columns: nonNullColumns,
      records: filteredRecords,
    };
  } catch (error) {
    console.error(`Error getting sample records for ${tableName}:`, error);
    return { columns: [], records: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * GET /api/deep-analysis/missing-tables
 * Get detailed information about tables missing in target
 */
export async function POST(request: NextRequest) {
  try {
    const { missingTables } = await request.json();
    
    if (!missingTables || !Array.isArray(missingTables)) {
      return NextResponse.json(
        { success: false, error: 'Missing tables array is required' },
        { status: 400 }
      );
    }
    
    // Get source database connection
    const sourceConfig = await getConnectionConfig(1);
    if (!sourceConfig) {
      return NextResponse.json(
        { success: false, error: 'Source database not configured' },
        { status: 400 }
      );
    }
    
    const sourcePool = getOdooPool('source_ee', sourceConfig);
    
    // Gather detailed information for each missing table
    const detailedTables = await Promise.all(
      missingTables.map(async (table: { tableName: string; sourceRecordCount: number }) => {
        const dataType = classifyTable(table.tableName);
        const sampleData = await getSampleRecords(sourcePool, table.tableName, 20);
        
        return {
          tableName: table.tableName,
          recordCount: table.sourceRecordCount,
          dataType: dataType.category,
          description: dataType.description,
          sampleColumns: sampleData.columns,
          sampleRecords: sampleData.records,
          error: sampleData.error,
        };
      })
    );
    
    // Group by data type
    const groupedByType = {
      business_data: detailedTables.filter(t => t.dataType === 'business_data'),
      application_configuration: detailedTables.filter(t => t.dataType === 'application_configuration'),
      system_configuration: detailedTables.filter(t => t.dataType === 'system_configuration'),
      technical: detailedTables.filter(t => t.dataType === 'technical'),
    };
    
    return NextResponse.json({
      success: true,
      data: {
        tables: detailedTables,
        groupedByType,
        summary: {
          total: detailedTables.length,
          business_data: groupedByType.business_data.length,
          application_configuration: groupedByType.application_configuration.length,
          system_configuration: groupedByType.system_configuration.length,
          technical: groupedByType.technical.length,
        },
      },
    });
  } catch (error) {
    console.error('Error in missing tables analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze missing tables',
      },
      { status: 500 }
    );
  }
}
