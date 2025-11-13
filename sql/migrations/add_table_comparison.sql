-- Migration to add table comparison fields to analysis_results
-- Run this against the odoo_migration_config database

ALTER TABLE analysis_results 
  ADD COLUMN IF NOT EXISTS tables_with_data INTEGER,
  ADD COLUMN IF NOT EXISTS tables_missing_in_target INTEGER,
  ADD COLUMN IF NOT EXISTS tables_with_identical_records INTEGER,
  ADD COLUMN IF NOT EXISTS tables_with_compatible_diff INTEGER,
  ADD COLUMN IF NOT EXISTS tables_with_incompatible_diff INTEGER,
  ADD COLUMN IF NOT EXISTS table_comparison_details JSONB,
  ADD COLUMN IF NOT EXISTS comparison_completed_at TIMESTAMP;

-- Add index on comparison timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_comparison_date 
  ON analysis_results(comparison_completed_at);

-- Add comment to document the table structure
COMMENT ON COLUMN analysis_results.tables_with_data IS 
  'Number of tables that have data in source database';
  
COMMENT ON COLUMN analysis_results.tables_missing_in_target IS 
  'Number of tables with data in source but missing in target';
  
COMMENT ON COLUMN analysis_results.tables_with_identical_records IS 
  'Number of tables with exactly the same record count in both databases';
  
COMMENT ON COLUMN analysis_results.tables_with_compatible_diff IS 
  'Number of tables with different records but target has all necessary fields';
  
COMMENT ON COLUMN analysis_results.tables_with_incompatible_diff IS 
  'Number of tables with different records and target lacks necessary fields';
  
COMMENT ON COLUMN analysis_results.table_comparison_details IS 
  'Detailed breakdown of each table comparison result (JSONB array)';
