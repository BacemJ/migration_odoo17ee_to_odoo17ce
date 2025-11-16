# Quick Start Guide - Step 2: Incompatible Fields Analysis

## What is Step 2?

Step 2 analyzes **data loss in fields that don't exist in Odoo CE**. While Step 1 shows tables that are completely missing, Step 2 shows tables that exist in both EE and CE but have extra fields in EE that will lose their data during migration.

## Example Scenario

**Table**: `sale_order` exists in both EE and CE
- EE has field: `subscription_id` (from Subscriptions module - EE only)
- CE doesn't have this field
- **Result**: All subscription data in sales orders will be lost!

## How to Use

### Step 1: Run Table Comparison
```
Dashboard → Setup Tab → "Analyze & Compare Databases"
```

### Step 2: Find Incompatible Tables
Look for the **red section**: "Tables with Incompatible Differences"
- Example: 10 tables with incompatible differences

### Step 3: Analyze Data Loss
```
Click: "🔍 Analyze Data Loss Impact (Step 2)"
```

### Step 4: Review Results

#### Summary Dashboard Shows:
- **Tables Analyzed**: How many tables have missing fields
- **Business Data** (RED): Critical tables with data loss
- **Configuration** (ORANGE): Important settings
- **Technical** (BLUE): Low-impact technical data
- **Records Affected**: Total records that will lose data
- **Business Fields**: How many critical fields are affected

#### For Each Table, You Can See:
1. **Table Name**: e.g., `sale_order`
2. **Classification**: Business Data / Configuration / Technical
3. **Records Affected**: e.g., 150 out of 500 records
4. **Missing Fields**: List of fields that don't exist in CE

#### For Each Field, You Can See:
1. **Field Name**: e.g., `subscription_id`
2. **Data Type**: e.g., `integer`, `varchar`, `boolean`
3. **Business Critical**: Yes/No indicator
4. **Records with Data**: How many records have values in this field
5. **Sample Values**: Example data from the field

#### Sample Records View:
- Click "Show Data" to see actual records
- Fields that are missing in CE are **highlighted in red**
- Shows up to 10 sample records per table

## Real Example

```
Table: sale_order (Business Data)
├─ 500 total records
├─ 150 records will lose data
│
├─ Missing Field: subscription_id (Business Critical)
│  ├─ Type: integer
│  ├─ 150 records with data
│  └─ Sample values: 1, 2, 3, 4, 5
│
├─ Missing Field: subscription_start_date (Business Critical)
│  ├─ Type: date
│  ├─ 150 records with data
│  └─ Sample values: 2024-01-01, 2024-02-01, ...
│
└─ Sample Records (showing 10):
   Row 1: id=101, name="SO001", subscription_id=1 ⚠️, ...
   Row 2: id=102, name="SO002", subscription_id=2 ⚠️, ...
   ...
```

## What Each Classification Means

### 🔴 Business Data (Critical)
**Action Required**: These contain customer/operational data
- Examples: `sale_order`, `account_move`, `crm_lead`
- **You Must**: Export this data manually or find alternatives
- **Impact**: Loss could affect business operations

### 🟠 Configuration (Important)
**Review Needed**: Application settings and templates
- Examples: `documents_workflow_rule`, `quality_point`
- **You Must**: Document settings, may need to recreate in CE
- **Impact**: Lost automation/configuration, not historical data

### 🔵 Technical (Low Impact)
**Usually Safe**: System/temporary data
- Examples: `_rel` tables, `_wizard` tables
- **You Can**: Usually ignore these
- **Impact**: Minimal to none

## Decision Making Guide

### For Each Business Data Table:

1. **Check Records Affected**
   - Few records (< 10): May be manageable to handle manually
   - Many records (> 100): Need systematic approach

2. **Check Business-Critical Fields**
   - If YES: This data is important, plan export
   - If NO: Technical metadata, may be less critical

3. **Review Sample Data**
   - Look at actual values
   - Determine if you need this data
   - Check if it can be reconstructed

### Actions You Can Take:

✅ **Export to JSON/CSV** (Use Step 3: Export feature)
- Save all data from affected tables
- Keep as backup/reference
- Can be manually imported later if needed

✅ **Find CE Alternatives**
- Check if CE has different way to handle this
- Example: Subscriptions → Recurring invoices

✅ **Accept Data Loss**
- If data is not critical
- If it's just configuration that can be recreated
- Document the decision

❌ **Don't Proceed Blindly**
- Review all business data carefully
- Get stakeholder approval for data loss
- Document what will be lost

## Tips

1. **Focus on RED first**: Business data is most critical
2. **Use sample data**: Review actual values to understand impact
3. **Export before migration**: Save data you might need later
4. **Document decisions**: Keep record of accepted data loss
5. **Test with subset**: Try migration on test data first

## Common Scenarios

### Scenario 1: Subscriptions Module
**Problem**: Sales orders have `subscription_id` field
**Solution**: 
- Export subscription data to JSON
- Recreate subscriptions manually in CE
- Link to sales orders using reference fields

### Scenario 2: Helpdesk Module
**Problem**: Entire `helpdesk_ticket` table exists but has EE-only fields
**Solution**:
- Export all helpdesk data
- Use CE's support/ticket alternative
- Or keep EE instance read-only for historical reference

### Scenario 3: Document Management
**Problem**: Advanced document automation fields
**Solution**:
- Export document metadata
- Use simpler CE document features
- Reconfigure workflows in CE

## Questions to Ask

Before proceeding with migration:

1. ✅ Have I reviewed all RED (business data) tables?
2. ✅ Do I understand what data will be lost?
3. ✅ Have I exported critical data that I need?
4. ✅ Have I documented all data loss for stakeholders?
5. ✅ Do I have approval to proceed with this data loss?
6. ✅ Do I have a backup plan if I need the lost data?

## Need Help?

If you see many business-critical fields affected:
- Consider keeping EE instance for historical data
- Export everything to JSON/CSV for safety
- Consult with business users about impact
- Test migration on copy/staging environment first

## Next Steps

After completing Step 2 analysis:
1. **Step 3**: Export Data → Save critical business data to files
2. **Step 4**: Migrate → Perform actual data migration
3. **Step 5**: Validate → Verify migration success
