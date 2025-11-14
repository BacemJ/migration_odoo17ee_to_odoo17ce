# Table Metadata for Odoo 17 EE to CE Migration

## Overview

This directory contains metadata about Odoo 17 tables to help identify compatibility issues and problematic records during migration from Enterprise Edition to Community Edition.

## Files

- **`table_metadata_template.json`** - Template with examples showing the structure and key high-risk tables
- **`compatibility_full_cline.json`** - Your custom metadata file (to be completed)
- **`../scripts/generate-table-metadata.ts`** - Script to auto-generate initial metadata from your database

## Metadata Structure

Each table entry contains:

```json
{
  "public.table_name": {
    "full_compatible_with_odoo_17_CE": boolean,
    "can_have_incompatible_records_in_columns": boolean,
    "incompatibility_detection_method": "SQL query or description",
    "have_business_data": boolean,
    "table_role": "system|configuration|business|transactional|log|cache",
    "risk_level": "low|medium|high|critical",
    "notes": "Additional context"
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `full_compatible_with_odoo_17_CE` | boolean | `true` if the table structure exists in CE, `false` if it's EE-only |
| `can_have_incompatible_records_in_columns` | boolean | `true` if records may contain EE-specific data that would break CE |
| `incompatibility_detection_method` | string\|null | SQL query or logic to detect problematic records |
| `have_business_data` | boolean | `true` if the table contains user business data (not just system/config) |
| `table_role` | enum | Category: `system`, `configuration`, `business`, `transactional`, `log`, `cache` |
| `risk_level` | enum | Migration risk: `low`, `medium`, `high`, `critical` |
| `notes` | string | Optional notes about the table |

## High-Risk Tables (Critical Attention Required)

### 1. **`ir_module_module`** (CRITICAL)
- **Issue**: Contains EE module registrations
- **Detection**: `WHERE license = 'OEEL-1' OR name IN ('web_enterprise', 'web_studio', 'helpdesk', ...)`
- **Action**: Must uninstall/deactivate EE modules before migration

### 2. **`ir_config_parameter`** (HIGH)
- **Issue**: System parameters may reference EE features
- **Detection**: `WHERE key ILIKE '%enterprise%' OR key ILIKE '%studio%'`
- **Action**: Remove/update EE-specific config parameters

### 3. **`ir_ui_view`** (HIGH)
- **Issue**: Views may contain EE widgets, Studio customizations
- **Detection**: `WHERE arch_db::text ILIKE '%web_enterprise%' OR arch_db::text ILIKE '%studio%'`
- **Action**: Remove Studio customizations, replace EE widgets

### 4. **`ir_asset`** (HIGH)
- **Issue**: Asset bundles may reference EE JavaScript/CSS
- **Detection**: `WHERE path ILIKE '%/web_enterprise/%' OR path ILIKE '%/web_studio/%'`
- **Action**: Remove EE asset references

### 5. **`ir_model_data`** (CRITICAL)
- **Issue**: External IDs for EE modules
- **Detection**: `WHERE module IN ('web_enterprise', 'web_studio', 'helpdesk', ...)`
- **Action**: Clean EE module external IDs

### 6. **`ir_cron`** (HIGH)
- **Issue**: Scheduled actions may call EE models/methods
- **Detection**: Check `model_id` and `code` fields for EE references
- **Action**: Disable/remove cron jobs referencing EE features

### 7. **`res_users`** (HIGH)
- **Issue**: Users may have EE-only group memberships
- **Detection**: Check groups via `res_groups_users_rel` for EE groups
- **Action**: Remove EE group assignments

## Enterprise-Only Tables (Cannot Migrate)

These tables exist in EE but not in CE. Data must be exported to JSON for reference:

- `helpdesk_team`, `helpdesk_ticket` - Helpdesk module
- `documents_document`, `documents_folder` - Documents module
- `planning_slot`, `planning_template` - Planning module
- `sign_request`, `sign_template` - Sign module
- `approvals_approval`, `approvals_category` - Approvals module
- `voip_*` - VoIP module
- `iot_*` - IoT module
- `quality_*` - Quality module
- `sale_subscription*` - Subscriptions module
- `industry_fsm_*` - Field Service module

## How to Use

### Step 1: Generate Initial Metadata

Run the generator script to create initial metadata from your database:

```bash
npx ts-node scripts/generate-table-metadata.ts
```

This will:
- Connect to your source EE database
- List all tables
- Auto-categorize them based on naming patterns
- Generate `lib/odoo/table_metadata.json`

### Step 2: Review and Refine

The auto-generated file is a starting point. You should:

1. **Review each high-risk table** (marked as `risk_level: "high"` or `"critical"`)
2. **Test detection methods** by running the SQL queries against your database
3. **Add custom detection logic** for your specific customizations
4. **Document business context** in the `notes` field

### Step 3: Use in Record Analyzer

The `record-analyzer.ts` module uses this metadata to:

1. Load detection methods for each table
2. Run SQL queries to find problematic records
3. Report counts and samples
4. Provide sanitization recommendations

### Step 4: Export EE-Only Data

For tables where `full_compatible_with_odoo_17_CE: false`:

1. Export all records to JSON (use export API)
2. Store in backup location
3. Document migration path (if any alternative CE solution exists)

## Common Enterprise Tokens to Detect

Use these patterns in your detection methods:

**Modules:**
- `web_enterprise`, `web_studio`, `helpdesk`, `documents`, `planning`
- `approvals`, `sign`, `voip`, `iot`, `quality_control`
- `industry_fsm`, `social_marketing`, `sale_subscription`

**Widgets:**
- `widget="web_ribbon"`, `widget="pdf_viewer"`, `widget="studio_approval"`

**Themes:**
- `theme_*_enterprise`, `/web_enterprise/`, `/theme_*/enterprise/`

**Studio:**
- `studio_`, `.studio_`, `x_studio_`, `_x_studio_`

**Assets:**
- `/web_enterprise/static/`, `/web_studio/static/`

## Example Detection Queries

### Find views with Studio customizations:
```sql
SELECT id, name, key, model
FROM ir_ui_view
WHERE key ILIKE '%.studio_%'
   OR arch_db::text ILIKE '%x_studio_%'
   OR arch_db::text ILIKE '%web_studio%';
```

### Find config parameters with EE references:
```sql
SELECT key, value
FROM ir_config_parameter
WHERE key ILIKE '%enterprise%'
   OR key ILIKE '%studio%'
   OR value::text ILIKE '%enterprise%';
```

### Find users with EE group memberships:
```sql
SELECT u.id, u.login, g.name as group_name
FROM res_users u
JOIN res_groups_users_rel r ON u.id = r.uid
JOIN res_groups g ON r.gid = g.id
WHERE g.name ILIKE '%helpdesk%'
   OR g.name ILIKE '%planning%'
   OR g.name ILIKE '%documents%'
   OR g.name ILIKE '%studio%';
```

## Integration with Migration Tool

This metadata is used by:

1. **`lib/migration/record-analyzer.ts`** - Scans tables for problematic records
2. **`app/api/analyze-records/route.ts`** - API endpoint for analysis
3. **Export UI** - Shows which records need attention before migration

## Contributing

When you discover new incompatibility patterns:

1. Add the detection method to this metadata
2. Test the SQL query
3. Document the fix/workaround in notes
4. Share learnings with the team

## License

This metadata is specific to your Odoo 17 migration project.
