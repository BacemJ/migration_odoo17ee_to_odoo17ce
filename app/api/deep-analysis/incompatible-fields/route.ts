import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getOdooPool, executeQuery, getConnectionConfig } from '@/lib/database/connection';

interface TableDataType {
  category: 'business_data' | 'system_configuration' | 'application_configuration' | 'technical';
  description: string;
}

interface ColumnDataLoss {
  columnName: string;
  dataType: string;
  recordsWithData: number;
  isBusinessCritical: boolean;
  sampleValues: unknown[];
}

interface FieldDataLossAnalysis {
  tableName: string;
  dataType: TableDataType;
  missingColumns: ColumnDataLoss[];
  totalRecordsInTable: number;
  recordsWithDataLoss: number;
  sampleRecords: Record<string, unknown>[];
}

// Classification of Odoo tables by data type
const TABLE_DATA_TYPES: Record<string, TableDataType> = {
  // Business Data - Critical
  'res_partner': { category: 'business_data', description: 'Contacts and customers' },
  'sale_order': { category: 'business_data', description: 'Sales orders' },
  'sale_order_line': { category: 'business_data', description: 'Sales order items' },
  'account_move': { category: 'business_data', description: 'Accounting entries/invoices' },
  'account_move_line': { category: 'business_data', description: 'Journal entry lines' },
  'purchase_order': { category: 'business_data', description: 'Purchase orders' },
  'purchase_order_line': { category: 'business_data', description: 'Purchase order items' },
  'stock_move': { category: 'business_data', description: 'Inventory movements' },
  'stock_picking': { category: 'business_data', description: 'Delivery orders' },
  'product_template': { category: 'business_data', description: 'Product templates' },
  'product_product': { category: 'business_data', description: 'Product variants' },
  'crm_lead': { category: 'business_data', description: 'CRM leads and opportunities' },
  'project_project': { category: 'business_data', description: 'Projects' },
  'project_task': { category: 'business_data', description: 'Project tasks' },
  'hr_employee': { category: 'business_data', description: 'Employees' },
  'mrp_production': { category: 'business_data', description: 'Manufacturing orders' },
  
  // Enterprise-specific business data
  'helpdesk_team': { category: 'business_data', description: 'Helpdesk teams and configuration' },
  'helpdesk_ticket': { category: 'business_data', description: 'Customer support tickets' },
  'helpdesk_stage': { category: 'business_data', description: 'Ticket workflow stages' },
  'helpdesk_sla': { category: 'business_data', description: 'Service level agreements' },
  'helpdesk_tag': { category: 'business_data', description: 'Ticket categorization tags' },
  
  'documents_document': { category: 'business_data', description: 'Document management files' },
  'documents_folder': { category: 'business_data', description: 'Document folders structure' },
  'documents_tag': { category: 'business_data', description: 'Document classification tags' },
  'documents_share': { category: 'business_data', description: 'Document sharing links' },
  
  'planning_slot': { category: 'business_data', description: 'Employee planning schedules' },
  'planning_role': { category: 'business_data', description: 'Planning roles' },
  'planning_template': { category: 'business_data', description: 'Planning templates' },
  
  'sign_request': { category: 'business_data', description: 'Electronic signature requests' },
  'sign_template': { category: 'business_data', description: 'Signature templates' },
  'sign_item': { category: 'business_data', description: 'Signature items' },
  
  'approval_request': { category: 'business_data', description: 'Approval requests' },
  'approval_approver': { category: 'business_data', description: 'Approval workflow participants' },
  
  'quality_check': { category: 'business_data', description: 'Quality inspection records' },
  'quality_alert': { category: 'business_data', description: 'Quality alerts and issues' },
  
  'sale_subscription': { category: 'business_data', description: 'Recurring subscriptions' },
  'sale_subscription_line': { category: 'business_data', description: 'Subscription line items' },
  
  'voip_phonecall': { category: 'business_data', description: 'VoIP call records' },
  
  // Application Configuration
  'documents_workflow_rule': { category: 'application_configuration', description: 'Document automation rules' },
  'planning_recurrency': { category: 'application_configuration', description: 'Recurring planning patterns' },
  'approval_category': { category: 'application_configuration', description: 'Approval categories' },
  'quality_point': { category: 'application_configuration', description: 'Quality control checkpoints' },
  'sale_subscription_template': { category: 'application_configuration', description: 'Subscription templates' },
  
  // System Configuration
  'iot_box': { category: 'system_configuration', description: 'IoT box devices' },
  'iot_device': { category: 'system_configuration', description: 'Connected IoT devices' },
  'voip_configurator': { category: 'system_configuration', description: 'VoIP configuration' },
};

// Business-critical field patterns
const BUSINESS_CRITICAL_FIELD_PATTERNS = [
  'amount', 'price', 'cost', 'total', 'subtotal', 'tax',
  'quantity', 'qty',
  'date', 'deadline',
  'name', 'description', 'note',
  'state', 'stage_id', 'status',
  'partner_id', 'customer_id', 'user_id', 'employee_id',
  'reference', 'ref', 'origin',
];

// Technical/system fields that are less critical
const TECHNICAL_FIELD_PATTERNS = [
  '_company_id', '_currency_id',
  'create_', 'write_', '__last_update',
  'display_name', 'access_',
  'message_', 'activity_',
];

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
  
  // Default to business data
  return { category: 'business_data', description: 'Business data table' };
}

function isBusinessCriticalField(columnName: string, tableName: string): boolean {
  const lowerColumn = columnName.toLowerCase();
  
  // Check if it's a technical field (not business critical)
  for (const pattern of TECHNICAL_FIELD_PATTERNS) {
    if (lowerColumn.includes(pattern)) {
      return false;
    }
  }
  
  // Check if it's a business critical field
  for (const pattern of BUSINESS_CRITICAL_FIELD_PATTERNS) {
    if (lowerColumn.includes(pattern)) {
      return true;
    }
  }
  
  // Default: consider it business critical if it's in a business data table
  const tableType = classifyTable(tableName);
  return tableType.category === 'business_data';
}

async function analyzeColumnDataLoss(
  pool: Pool,
  tableName: string,
  columnName: string,
  dataType: string
): Promise<ColumnDataLoss> {
  // Count records with non-null values in this column
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM "${tableName}" 
    WHERE "${columnName}" IS NOT NULL
  `;
  const countResult = await executeQuery<{ count: string }>(pool, countQuery);
  const recordsWithData = parseInt(countResult[0].count);
  
  // Get sample values (up to 5 unique values)
  const sampleQuery = `
    SELECT DISTINCT "${columnName}" as value
    FROM "${tableName}"
    WHERE "${columnName}" IS NOT NULL
    LIMIT 5
  `;
  const sampleResult = await executeQuery<{ value: unknown }>(pool, sampleQuery);
  const sampleValues = sampleResult.map(r => r.value);
  
  return {
    columnName,
    dataType,
    recordsWithData,
    isBusinessCritical: isBusinessCriticalField(columnName, tableName),
    sampleValues,
  };
}

async function getSampleRecordsWithDataLoss(
  pool: Pool,
  tableName: string,
  missingColumns: string[],
  limit: number = 10
): Promise<Record<string, unknown>[]> {
  try {
    // Build WHERE clause to find records with at least one non-null missing column
    const whereConditions = missingColumns.map(col => `"${col}" IS NOT NULL`).join(' OR ');
    
    // Get all columns
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
      ORDER BY ordinal_position
    `;
    const columns = await executeQuery<{ column_name: string; data_type: string }>(pool, columnsQuery, [tableName]);
    
    // Build SELECT query with all columns
    const columnsList = columns.map(c => `"${c.column_name}"`).join(', ');
    const query = `
      SELECT ${columnsList}
      FROM "${tableName}"
      WHERE ${whereConditions}
      LIMIT ${limit}
    `;
    
    const records = await executeQuery<Record<string, unknown>>(pool, query);
    
    // Add metadata about which columns are missing in CE
    return records.map(record => ({
      ...record,
      _missingInCE: missingColumns,
    }));
  } catch (error) {
    console.error(`Error getting sample records for ${tableName}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const targetId = searchParams.get('targetId');
    
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'Missing sourceId or targetId parameter' },
        { status: 400 }
      );
    }

    // Get incompatible tables from the comparison
    const incompatibleTablesParam = searchParams.get('incompatibleTables');
    if (!incompatibleTablesParam) {
      return NextResponse.json(
        { error: 'Missing incompatibleTables parameter' },
        { status: 400 }
      );
    }

    const incompatibleTables = JSON.parse(incompatibleTablesParam);
    
    // Get source database connection
    const sourceConfig = await getConnectionConfig(parseInt(sourceId));
    const sourcePool = getOdooPool(`source_${sourceId}`, sourceConfig);

    const results: FieldDataLossAnalysis[] = [];

    // Analyze each incompatible table
    for (const table of incompatibleTables) {
      const { tableName, missingColumns } = table;
      
      console.log(`Analyzing data loss for table: ${tableName}`);
      
      // Get total record count
      const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const countResult = await executeQuery<{ count: string }>(sourcePool, countQuery);
      const totalRecords = parseInt(countResult[0].count);
      
      // Build WHERE clause to count records with data in any missing column
      const whereConditions = missingColumns.map((col: string) => `"${col}" IS NOT NULL`).join(' OR ');
      const dataLossCountQuery = `
        SELECT COUNT(*) as count 
        FROM "${tableName}" 
        WHERE ${whereConditions}
      `;
      const dataLossResult = await executeQuery<{ count: string }>(sourcePool, dataLossCountQuery);
      const recordsWithDataLoss = parseInt(dataLossResult[0].count);
      
      // Get column details and data types
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name = ANY($2::text[])
      `;
      const columnDetails = await executeQuery<{ column_name: string; data_type: string }>(
        sourcePool,
        columnsQuery,
        [tableName, missingColumns]
      );
      
      // Analyze each missing column
      const columnAnalyses: ColumnDataLoss[] = [];
      for (const col of columnDetails) {
        const analysis = await analyzeColumnDataLoss(
          sourcePool,
          tableName,
          col.column_name,
          col.data_type
        );
        columnAnalyses.push(analysis);
      }
      
      // Get sample records
      const sampleRecords = await getSampleRecordsWithDataLoss(
        sourcePool,
        tableName,
        missingColumns,
        10
      );
      
      results.push({
        tableName,
        dataType: classifyTable(tableName),
        missingColumns: columnAnalyses,
        totalRecordsInTable: totalRecords,
        recordsWithDataLoss,
        sampleRecords,
      });
    }

    // Sort by business criticality and record count
    results.sort((a, b) => {
      // Business data first
      if (a.dataType.category === 'business_data' && b.dataType.category !== 'business_data') {
        return -1;
      }
      if (a.dataType.category !== 'business_data' && b.dataType.category === 'business_data') {
        return 1;
      }
      // Then by records with data loss (descending)
      return b.recordsWithDataLoss - a.recordsWithDataLoss;
    });

    return NextResponse.json({
      success: true,
      analysis: results,
      summary: {
        totalTablesAnalyzed: results.length,
        businessDataTables: results.filter(r => r.dataType.category === 'business_data').length,
        configurationTables: results.filter(r => 
          r.dataType.category === 'application_configuration' || 
          r.dataType.category === 'system_configuration'
        ).length,
        technicalTables: results.filter(r => r.dataType.category === 'technical').length,
        totalRecordsWithDataLoss: results.reduce((sum, r) => sum + r.recordsWithDataLoss, 0),
        businessCriticalFieldsAffected: results.reduce((sum, r) => 
          sum + r.missingColumns.filter(c => c.isBusinessCritical).length, 0
        ),
      },
    });

  } catch (error) {
    console.error('Error in incompatible fields analysis:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze incompatible fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
