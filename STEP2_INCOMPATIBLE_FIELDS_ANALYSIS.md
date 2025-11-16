# Step 2: Incompatible Fields Data Loss Analysis

## Overview
Step 2 of the deep analysis identifies and classifies data that will be lost due to fields (columns) that exist in Odoo EE but don't exist in Odoo CE.

## Features Implemented

### 1. API Route: `/api/deep-analysis/incompatible-fields`
**File**: `app/api/deep-analysis/incompatible-fields/route.ts`

**Functionality**:
- Accepts `sourceId`, `targetId`, and list of incompatible tables with their missing columns
- For each table with incompatible fields:
  - Counts total records in the table
  - Counts records that have data in at least one missing field
  - Analyzes each missing column individually:
    - Counts records with non-null values in that column
    - Classifies if the field is business-critical
    - Retrieves sample values from the column
  - Gets sample records that contain data in missing fields

**Response Structure**:
```json
{
  "success": true,
  "analysis": [
    {
      "tableName": "sale_order",
      "dataType": {
        "category": "business_data",
        "description": "Sales orders"
      },
      "missingColumns": [
        {
          "columnName": "subscription_id",
          "dataType": "integer",
          "recordsWithData": 150,
          "isBusinessCritical": true,
          "sampleValues": [1, 2, 3, 4, 5]
        }
      ],
      "totalRecordsInTable": 500,
      "recordsWithDataLoss": 150,
      "sampleRecords": [...]
    }
  ],
  "summary": {
    "totalTablesAnalyzed": 10,
    "businessDataTables": 5,
    "configurationTables": 3,
    "technicalTables": 2,
    "totalRecordsWithDataLoss": 1250,
    "businessCriticalFieldsAffected": 15
  }
}
```

### 2. Data Classification System

**Table Classification**:
- **Business Data**: Critical customer/operational data (orders, invoices, partners, etc.)
- **Application Configuration**: App settings, templates, workflows
- **System Configuration**: IoT devices, VoIP settings, system configs
- **Technical**: Temporary tables, wizards, many-to-many relations

**Field Classification**:
Business-critical fields are identified by patterns:
- Amount/financial fields: `amount`, `price`, `cost`, `total`, `tax`
- Quantity fields: `quantity`, `qty`
- Date fields: `date`, `deadline`
- Core fields: `name`, `description`, `note`
- Status fields: `state`, `stage_id`, `status`
- Relationship fields: `partner_id`, `customer_id`, `user_id`
- Reference fields: `reference`, `ref`, `origin`

Non-critical technical fields:
- Company/currency fields: `_company_id`, `_currency_id`
- Audit fields: `create_`, `write_`, `__last_update`
- UI fields: `display_name`, `access_`
- Chatter fields: `message_`, `activity_`

### 3. UI Component: `IncompatibleFieldsView`
**File**: `components/migration-wizard/IncompatibleFieldsView.tsx`

**Features**:
- Summary dashboard with key metrics
- Critical warning alert for business data affected
- Grouped display by data type:
  - Business Data Tables (highlighted in red - critical)
  - Configuration Tables (orange - important)
  - Technical Tables (blue - low impact)
- Expandable accordion for each table showing:
  - Missing field details with business-critical indicator
  - Records affected count
  - Sample values from missing fields
  - Complete sample records with missing fields highlighted
- Toggle buttons to show/hide sample data

### 4. Integration with TableComparisonView
**File**: `components/migration-wizard/TableComparisonView.tsx`

**Enhancements**:
- Added "Analyze Data Loss Impact (Step 2)" button in incompatible differences section
- Shows warning message about data loss
- Triggers API call to analyze incompatible fields
- Displays IncompatibleFieldsView component below the comparison when analysis completes

### 5. Dashboard Page Updates
**File**: `app/dashboard/page.tsx`

**Changes**:
- Added state for source and target connection IDs
- Loads connection IDs on component mount
- Passes connection IDs to TableComparisonView component
- Enables deep analysis to work with correct database connections

## Usage Flow

1. **Run Table Comparison** (Setup tab)
   - Click "Analyze & Compare Databases"
   - View tables with incompatible differences

2. **Analyze Data Loss** (within incompatible differences section)
   - Click "🔍 Analyze Data Loss Impact (Step 2)" button
   - System analyzes all fields that will be lost
   - Classifies data by type and criticality

3. **Review Results**
   - See summary metrics:
     - Total tables/records affected
     - Business data vs configuration vs technical
     - Business-critical fields count
   - Expand business data tables (most critical)
   - View which fields will be lost
   - See how many records contain data in those fields
   - Review sample values and sample records
   - Identify which data needs manual export/handling

4. **Decision Making**
   - **Business Data**: Critical - requires manual export or alternative solution
   - **Configuration**: Important - may need to be recreated in CE
   - **Technical**: Low impact - usually safe to ignore

## Data Security
- All database passwords remain encrypted
- Analysis is read-only (no modifications to source)
- Sample data limited to 10 records per table
- Sample values limited to 5 unique values per column

## Example Output

For a table like `sale_order` with a missing `subscription_id` field:
```
Table: sale_order (Business Data - Sales orders)
├─ Total Records: 500
├─ Records with Data Loss: 150
└─ Missing Fields:
   └─ subscription_id (integer) [Business Critical]
      ├─ 150 records with data
      ├─ Sample values: 1, 2, 3, 4, 5
      └─ Impact: Subscription information will be lost
```

## Benefits

1. **Visibility**: Shows exactly what data will be lost
2. **Prioritization**: Classifies by business impact
3. **Evidence**: Provides sample data for review
4. **Planning**: Helps decide what to export manually
5. **Documentation**: Records can be exported for audit trail

## Next Steps

After reviewing Step 2 results:
- Export critical business data to JSON/CSV (Step 3)
- Plan manual workarounds for lost functionality
- Document data that will be lost for stakeholders
- Proceed with migration only after acceptance of data loss
