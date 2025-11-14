/**
 * Script to generate table compatibility metadata structure
 * Run with: npx ts-node scripts/generate-table-metadata.ts
 */

import { getConfigPool, executeQuery, getOdooPool } from '../lib/database/connection';
import { getConnectionByRole, getConnectionWithPassword } from '../lib/database/credential-manager';
import * as fs from 'fs';
import * as path from 'path';

interface TableMetadata {
  full_compatible_with_odoo_17_CE: boolean;
  can_have_incompatible_records_in_columns: boolean;
  incompatibility_detection_method: string | null;
  have_business_data: boolean;
  table_role: 'system' | 'configuration' | 'business' | 'transactional' | 'log' | 'cache';
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
}

const KNOWN_ENTERPRISE_TABLES = [
  // Enterprise-specific modules
  'helpdesk_team', 'helpdesk_ticket', 'helpdesk_stage', 'helpdesk_tag',
  'project_task_forecast', 'project_forecast',
  'planning_slot', 'planning_template', 'planning_role',
  'documents_document', 'documents_folder', 'documents_tag', 'documents_workflow_rule',
  'sign_request', 'sign_item', 'sign_template',
  'approvals_approval', 'approvals_category', 'approvals_approver',
  'voip_call', 'voip_queue',
  'iot_device', 'iot_box',
  'sale_subscription', 'sale_subscription_line',
  'industry_fsm_report',
  'quality_check', 'quality_point', 'quality_alert',
  'mrp_plm_', // PLM tables
  'social_', // Social Marketing
  'website_studio_', // Website Studio
];

const SYSTEM_TABLES = [
  'ir_', 'res_groups', 'res_users', 'res_lang', 'res_currency', 'res_country',
  'base_', 'auth_', 'bus_', 'web_tour_', 'onboarding_',
];

const CONFIGURATION_TABLES = [
  'ir_config_parameter', 'ir_cron', 'ir_sequence', 'ir_mail_server',
  'payment_provider', 'delivery_carrier', 'stock_warehouse', 'stock_location',
  'pos_config', 'pos_payment_method',
];

const BUSINESS_DATA_TABLES = [
  'res_partner', 'res_company', 'product_template', 'product_product',
  'sale_order', 'purchase_order', 'account_move', 'stock_picking',
  'crm_lead', 'project_project', 'project_task',
];

const TRANSACTIONAL_TABLES = [
  'account_move_line', 'stock_move', 'stock_move_line', 'pos_order',
  'payment_transaction', 'account_payment',
];

function categorizeTable(tableName: string): TableMetadata['table_role'] {
  if (SYSTEM_TABLES.some(prefix => tableName.startsWith(prefix))) return 'system';
  if (CONFIGURATION_TABLES.some(name => tableName.includes(name))) return 'configuration';
  if (TRANSACTIONAL_TABLES.some(name => tableName.includes(name))) return 'transactional';
  if (BUSINESS_DATA_TABLES.some(name => tableName.includes(name))) return 'business';
  if (tableName.includes('_log') || tableName.includes('_history')) return 'log';
  if (tableName.includes('_cache') || tableName.includes('bus_bus')) return 'cache';
  return 'business';
}

function isEnterpriseOnly(tableName: string): boolean {
  return KNOWN_ENTERPRISE_TABLES.some(eeTable => tableName.includes(eeTable));
}

function getDetectionMethod(tableName: string): string | null {
  // Tables that might have EE-specific data in records
  if (tableName === 'ir_module_module') {
    return 'Check module.license field for "OEEL-1" and module.name for enterprise modules';
  }
  if (tableName === 'ir_config_parameter') {
    return 'Check key field for enterprise-related parameters (web.base.url.freeze, studio, enterprise_code)';
  }
  if (tableName === 'ir_ui_view') {
    return 'Check arch_db field for enterprise widgets, studio customizations, web_enterprise references';
  }
  if (tableName === 'ir_asset') {
    return 'Check path field for /web_enterprise/, /web_studio/, /theme_*_enterprise/ references';
  }
  if (tableName === 'ir_attachment') {
    return 'Check res_model and url fields for enterprise module references';
  }
  if (tableName === 'ir_model_data') {
    return 'Check module field for enterprise module names';
  }
  if (tableName === 'ir_cron') {
    return 'Check code and model_id fields for enterprise model/method references';
  }
  if (tableName === 'mail_template') {
    return 'Check model field and body_html for enterprise features';
  }
  if (tableName === 'res_users') {
    return 'Check groups_id relation for enterprise-only groups';
  }
  if (tableName.includes('website')) {
    return 'Check theme-related fields for enterprise theme references';
  }
  
  return null;
}

async function generateMetadata() {
  try {
    console.log('Connecting to source database...');
    
    const sourceConnection = await getConnectionByRole('source_ee');
    if (!sourceConnection) {
      throw new Error('Source EE database connection not configured');
    }

    const sourceConfig = await getConnectionWithPassword(sourceConnection.id);
    if (!sourceConfig) {
      throw new Error('Failed to retrieve source connection configuration');
    }

    const sourcePool = getOdooPool(`source_${sourceConnection.id}`, {
      host: sourceConfig.host,
      port: sourceConfig.port,
      database: sourceConfig.database,
      user: sourceConfig.username,
      password: sourceConfig.encrypted_password,
    });

    // Get all tables from source
    console.log('Fetching tables...');
    const tables = await executeQuery<{ tablename: string }>(
      sourcePool,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    console.log(`Found ${tables.length} tables. Generating metadata...`);

    const metadata: Record<string, TableMetadata> = {};

    for (const { tablename } of tables) {
      const isEEOnly = isEnterpriseOnly(tablename);
      const role = categorizeTable(tablename);
      const detectionMethod = getDetectionMethod(tablename);
      
      metadata[`public.${tablename}`] = {
        full_compatible_with_odoo_17_CE: !isEEOnly,
        can_have_incompatible_records_in_columns: detectionMethod !== null,
        incompatibility_detection_method: detectionMethod,
        have_business_data: ['business', 'transactional'].includes(role),
        table_role: role,
        risk_level: isEEOnly ? 'critical' : detectionMethod ? 'high' : role === 'system' ? 'medium' : 'low',
        notes: isEEOnly ? 'Enterprise-only table - not present in CE' : undefined,
      };
    }

    // Write to file
    const outputPath = path.join(__dirname, '..', 'lib', 'odoo', 'table_metadata.json');
    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
    
    console.log(`✅ Metadata generated successfully!`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📊 Total tables: ${tables.length}`);
    console.log(`📊 Enterprise-only: ${Object.values(metadata).filter(m => !m.full_compatible_with_odoo_17_CE).length}`);
    console.log(`📊 With detection methods: ${Object.values(metadata).filter(m => m.can_have_incompatible_records_in_columns).length}`);

    await sourcePool.end();
  } catch (error) {
    console.error('Error generating metadata:', error);
    process.exit(1);
  }
}

generateMetadata();
