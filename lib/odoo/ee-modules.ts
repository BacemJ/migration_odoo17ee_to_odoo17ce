/**
 * Comprehensive list of Odoo 17 Enterprise Edition modules
 * These modules exist only in EE and must be handled during migration to CE
 */

export const EE_MODULES = [
  // Web & Core
  'web_enterprise',
  'web_mobile',
  'web_studio',
  
  // Accounting & Finance
  'account_accountant',
  'account_accountant_batch_payment',
  'account_asset',
  'account_bank_statement_import_qif',
  'account_budget',
  'account_consolidation',
  'account_disallowed_expenses',
  'account_invoice_extract',
  'account_online_synchronization',
  'account_reports',
  'account_sepa',
  'account_sepa_direct_debit',
  'account_taxcloud',
  'account_3way_match',
  
  // Payroll
  'hr_payroll',
  'hr_payroll_account',
  'hr_payroll_expense',
  
  // Documents & Spreadsheet
  'documents',
  'documents_account',
  'documents_hr',
  'documents_hr_contract',
  'documents_hr_recruitment',
  'documents_product',
  'documents_project',
  'documents_sign',
  'documents_spreadsheet',
  'spreadsheet',
  'spreadsheet_dashboard',
  'spreadsheet_edition',
  
  // E-Signature
  'sign',
  'sign_itsme',
  
  // ESG
  'esg',
  
  // CRM & Sales
  'crm_enterprise',
  'sale_enterprise',
  'sale_subscription',
  'sale_subscription_dashboard',
  'sale_amazon',
  'sale_ebay',
  
  // Rental
  'sale_renting',
  'sale_renting_sign',
  
  // Website & E-Commerce
  'website_enterprise',
  'website_studio',
  'website_sale_dashboard',
  'website_helpdesk',
  'website_helpdesk_form',
  'website_helpdesk_forum',
  'website_helpdesk_livechat',
  'website_helpdesk_slides',
  
  // Live Chat & Communication
  'im_livechat_enterprise',
  'voip',
  'voip_crm',
  'voip_onsip',
  
  // eLearning
  'website_slides',
  'website_slides_forum',
  'website_slides_survey',
  
  // Inventory & Barcode
  'stock_enterprise',
  'stock_barcode',
  'stock_barcode_quality_control',
  'quality_control',
  'quality_control_worksheet',
  'quality_mrp_workorder',
  
  // Manufacturing (MRP)
  'mrp_enterprise',
  'mrp_workorder',
  'mrp_plm',
  'mrp_mps',
  
  // Maintenance
  'maintenance',
  'maintenance_worksheet',
  
  // Human Resources
  'hr_recruitment_enterprise',
  'hr_referral',
  'hr_appraisal',
  'hr_appraisal_survey',
  'hr_attendance_enterprise',
  'hr_contract_enterprise',
  'hr_contract_reports',
  'hr_contract_salary',
  'hr_contract_sign',
  
  // Fleet
  'fleet',
  'fleet_account',
  
  // Marketing
  'social_facebook',
  'social_instagram',
  'social_linkedin',
  'social_push_notifications',
  'social_twitter',
  'social_youtube',
  'mass_mailing_sms',
  'mass_mailing_themes',
  'marketing_automation',
  'marketing_automation_sms',
  
  // Services & Projects
  'project_enterprise',
  'project_forecast',
  'industry_fsm',
  'industry_fsm_report',
  'industry_fsm_sale',
  'industry_fsm_stock',
  'helpdesk',
  'helpdesk_account',
  'helpdesk_mail_plugin',
  'helpdesk_sale',
  'helpdesk_sale_timesheet',
  'helpdesk_stock',
  'helpdesk_timesheet',
  
  // Planning & Appointments
  'planning',
  'planning_hr_contract',
  'planning_hr_skills',
  'appointment',
  'appointment_account_payment',
  'appointment_crm',
  'appointment_hr_recruitment',
  
  // Timesheets
  'timesheet_grid',
  'hr_timesheet_attendance',
  
  // Productivity & Approvals
  'approvals',
  'studio',
  
  // IoT
  'iot',
  'pos_iot',
  
  // Expenses
  'hr_expense_extract',
  
  // Purchase
  'purchase_enterprise',
  'purchase_product_matrix',
  
  // Product Matrix
  'sale_product_matrix',
  'product_matrix',
] as const;

export type EEModule = typeof EE_MODULES[number];

/**
 * Enterprise Edition table patterns
 * Tables matching these patterns are likely EE-only
 */
export const EE_TABLE_PATTERNS = [
  'helpdesk_%',
  'documents_%',
  'sale_subscription%',
  'planning_%',
  'studio_%',
  'sign_%',
  'approvals_%',
  'approval_%',
  'voip_%',
  'iot_%',
  'account_asset%',
  'account_budget%',
  'account_consolidation%',
  'hr_payroll%',
  'spreadsheet_%',
  'social_%',
  'marketing_automation%',
  'industry_fsm%',
  'appointment_%',
  'quality_%',
  'mrp_plm%',
  'mrp_workorder%',
  'maintenance_%',
  'fleet_%',
  'hr_appraisal%',
  'hr_referral%',
  'sale_renting%',
  'account_disallowed_expenses%',
  'web_studio%',
] as const;

/**
 * Known Enterprise Edition tables (non-exhaustive)
 */
export const EE_TABLES = [
  // Helpdesk
  'helpdesk_ticket',
  'helpdesk_team',
  'helpdesk_sla',
  'helpdesk_stage',
  'helpdesk_tag',
  
  // Documents
  'documents_document',
  'documents_folder',
  'documents_tag',
  'documents_facet',
  'documents_workflow_rule',
  'documents_workflow_action',
  'documents_share',
  
  // Spreadsheet
  'spreadsheet_template',
  'spreadsheet_dashboard',
  'spreadsheet_dashboard_share',
  'spreadsheet_cell_thread',
  
  // Sign
  'sign_request',
  'sign_request_item',
  'sign_request_item_value',
  'sign_item',
  'sign_item_value',
  'sign_template',
  
  // Subscriptions
  'sale_subscription',
  'sale_subscription_line',
  'sale_subscription_template',
  'sale_subscription_stage',
  'sale_subscription_alert',
  
  // Planning
  'planning_slot',
  'planning_template',
  'planning_role',
  'planning_recurrency',
  
  // Approvals
  'approval_category',
  'approval_request',
  'approval_approver',
  'approval_product_line',
  
  // Studio
  'studio_approval_rule',
  'studio_approval_entry',
  
  // VoIP
  'voip_phonecall',
  'voip_configurator',
  
  // IoT
  'iot_box',
  'iot_device',
  
  // Field Service
  'industry_fsm_order',
  
  // Payroll
  'hr_payroll_structure',
  'hr_payroll_structure_type',
  'hr_payslip',
  'hr_payslip_line',
  'hr_payslip_run',
  
  // Assets
  'account_asset',
  'account_asset_category',
  
  // Budget
  'crossovered_budget',
  'crossovered_budget_lines',
  
  // Marketing
  'marketing_campaign',
  'marketing_activity',
  'social_post',
  'social_account',
  'social_stream',
  
  // Appointments
  'appointment_type',
  'appointment_invite',
  
  // Fleet
  'fleet_vehicle',
  'fleet_vehicle_model',
  'fleet_vehicle_log_contract',
  'fleet_vehicle_log_services',
  
  // Maintenance
  'maintenance_equipment',
  'maintenance_request',
  'maintenance_team',
  
  // Quality
  'quality_point',
  'quality_check',
  'quality_alert',
  
  // PLM
  'mrp_eco',
  'mrp_eco_stage',
  
  // HR Appraisal
  'hr_appraisal',
  'hr_appraisal_goal',
  
  // HR Referral
  'hr_referral_friend',
  'hr_referral_level',
] as const;

export type EETable = typeof EE_TABLES[number];
