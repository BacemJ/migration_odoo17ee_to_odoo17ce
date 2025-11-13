# Odoo 17 EE to CE Migration Tool

A Next.js application designed to safely migrate Odoo 17 Enterprise Edition databases to Community Edition with comprehensive data preservation, validation, and safety features.

## Features

- **3-Database Architecture**: Safely migrate using source (EE), staging, and target (CE) databases
- **Comprehensive Analysis**: Detect EE modules, tables, dependencies, and calculate migration impact
- **Resumable Data Export**: Export critical EE data to compressed JSON files with checkpoint-based resume capability
- **Dry-Run Mode**: Preview migration steps before execution
- **Transaction-Based Migration**: Atomic operations with automatic rollback on errors
- **Post-Migration Validation**: Comprehensive validation checks to ensure clean migration
- **Encrypted Credentials**: Database passwords encrypted with AES-256-CBC
- **Real-Time Progress Tracking**: Monitor export, migration, and validation progress

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 13-16
- Odoo 17 Enterprise Edition database (source)
- Odoo 17 database instances for staging and target CE

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Create configuration database**:
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE odoo_migration_config;"

# Initialize schema
psql -U postgres -d odoo_migration_config -f sql/init-config-db.sql
```

3. **Configure environment variables**:

Edit `.env.local` and update:

```env
# Configuration Database Connection
CONFIG_DB_HOST=localhost
CONFIG_DB_PORT=5432
CONFIG_DB_NAME=odoo_migration_config
CONFIG_DB_USER=postgres
CONFIG_DB_PASSWORD=your_password

# Generate encryption key (32 bytes hex):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_key_here

# Export Directory
EXPORT_DIR=./exports
```

4. **Generate encryption key**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `ENCRYPTION_KEY` in `.env.local`.

## Getting Started

Run the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Migration Workflow

### 1. Configure Database Connections

Set up three database connections:
- **Source EE**: Your Odoo 17 Enterprise database (read-only recommended)
- **Staging**: Clone of your EE database where migration will be executed
- **Target CE**: Empty Odoo 17 CE database (for final manual cutover)

### 2. Run Analysis

Analyze the source EE database to:
- Detect installed Enterprise modules
- Identify EE-only tables
- Map foreign key dependencies
- Calculate estimated export size
- Assess migration risk level

### 3. Export EE Data

Export critical data from modules:
- Helpdesk, Subscriptions, Documents, Planning, Sign, Approvals, IoT, VoIP, Payroll, Fleet
- Automatically compressed if >1MB
- Resumable if interrupted

### 4. Execute Migration

**Dry-Run Mode**: Preview SQL scripts

**Execute Mode**: Run migration on staging:
- Disable EE cron jobs
- Mark EE modules as uninstalled
- Drop EE tables safely
- Clean orphaned records
- Vacuum and analyze database

### 5. Validate Results

Post-migration validation:
- No EE modules remain
- All EE tables removed
- No orphaned foreign keys
- Database integrity verified

### 6. Manual Cutover

Use pgAdmin to copy staging database to target CE after successful validation.

## Project Structure

```
├── app/
│   ├── api/           # API routes (analyze, export, migrate, validate)
│   ├── dashboard/     # Migration wizard UI
│   └── page.tsx       # Landing page
├── lib/
│   ├── database/      # Connection pooling & credential management
│   ├── migration/     # Analyzer, exporter, executor, validator
│   └── odoo/          # EE module definitions
├── sql/               # Database initialization scripts
└── components/        # UI components
```

## API Endpoints

- `GET/POST/DELETE /api/connections` - Connection management
- `POST /api/analyze` - Analyze source database
- `POST/GET /api/export` - Data export operations
- `POST/GET /api/migrate` - Migration execution
- `POST/GET /api/validate` - Validation checks

## Safety Features

- **Read-Only Source**: Source database only read, never modified
- **Transaction-Based**: Atomic operations with automatic rollback
- **Checkpointing**: Resume capability for exports
- **Dry-Run Preview**: See SQL before execution
- **Comprehensive Validation**: 8+ post-migration checks

## EE Modules Handled

100+ Enterprise modules including:
- Accounting, Documents, HR, Sales, Services, Marketing, Manufacturing, Productivity

See `lib/odoo/ee-modules.ts` for complete list.

## Troubleshooting

**Encryption key error:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Config database connection fails:**
```bash
psql -U postgres -d odoo_migration_config -c "SELECT 1;"
```

**Export/Migration interrupted:** Operations are resumable - simply restart.

## Development

```bash
npm run dev    # Development server
npm run build  # Production build
npm start      # Production server
npm run lint   # Linting
```

## Next Steps

The foundation is complete. To finish:
1. Build UI components for the wizard
2. Add Server-Sent Events for real-time updates
3. Enhance error handling
4. Add testing
5. Create documentation with screenshots

## License

Custom migration tool for internal use.
