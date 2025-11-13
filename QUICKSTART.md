# Quick Start Guide

Get the Odoo 17 EE to CE Migration Tool running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js 20+ installed (`node --version`)
- [ ] PostgreSQL 13-16 running (`psql --version`)
- [ ] Access to your Odoo 17 EE database
- [ ] npm installed (`npm --version`)

## Step-by-Step Setup

### 1. Generate Encryption Key (30 seconds)

```bash
node generate-key.js
```

Copy the output encryption key.

### 2. Update Environment File (1 minute)

Open `.env.local` and update these values:

```env
# Your PostgreSQL configuration database
CONFIG_DB_HOST=localhost
CONFIG_DB_PORT=5432
CONFIG_DB_NAME=odoo_migration_config
CONFIG_DB_USER=postgres
CONFIG_DB_PASSWORD=YOUR_POSTGRES_PASSWORD

# Paste your encryption key from step 1
ENCRYPTION_KEY=paste_your_64_character_hex_key_here

# Export directory (default is fine)
EXPORT_DIR=./exports
```

### 3. Create Configuration Database (1 minute)

```bash
# Create database
psql -U postgres -c "CREATE DATABASE odoo_migration_config;"

# Initialize schema
psql -U postgres -d odoo_migration_config -f sql/init-config-db.sql
```

You should see:
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
... (6 tables created)
CREATE INDEX
... (success messages)
```

### 4. Start Development Server (30 seconds)

```bash
npm run dev
```

Wait for:
```
✓ Starting...
✓ Ready in 2.5s
○ Local: http://localhost:3000
```

### 5. Open Application (10 seconds)

Visit: **http://localhost:3000**

You should see the landing page with "Launch Migration Wizard" button.

## Verify Installation

### Test Configuration Database Connection

```bash
psql -U postgres -d odoo_migration_config -c "SELECT COUNT(*) FROM database_connections;"
```

Expected output:
```
 count 
-------
     0
(1 row)
```

### Test API Endpoints

Open a new terminal:

```bash
# Test connections endpoint
curl http://localhost:3000/api/connections
```

Expected response:
```json
{"success":true,"data":[]}
```

## Next Steps

### Configure Your First Connection

Use the API to add your source EE database:

```bash
curl -X POST http://localhost:3000/api/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production EE Database",
    "host": "localhost",
    "port": 5432,
    "database": "odoo_production_ee",
    "username": "odoo",
    "password": "your_odoo_password",
    "role": "source_ee"
  }'
```

Success response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Production EE Database",
    "role": "source_ee"
    ...
  },
  "message": "Connection created successfully"
}
```

### Run Your First Analysis

```bash
curl -X POST http://localhost:3000/api/analyze
```

This will:
1. Create a migration job
2. Scan your EE database
3. Detect installed EE modules
4. Identify EE tables
5. Calculate export size
6. Return analysis results

## Common Issues

### "ENCRYPTION_KEY must be a 32-byte hex string"

**Solution**: Run `node generate-key.js` and copy the entire output to `.env.local`

### "Connection failed" when creating database connection

**Solutions**:
1. Check PostgreSQL is running: `psql -U postgres -c "SELECT 1;"`
2. Verify credentials in connection request
3. Check firewall allows PostgreSQL connections
4. Ensure database exists: `psql -U postgres -l | grep odoo`

### "Cannot connect to config database"

**Solutions**:
1. Verify `.env.local` has correct credentials
2. Ensure config database exists: `psql -U postgres -l | grep odoo_migration_config`
3. Restart development server after updating `.env.local`

### Port 3000 already in use

**Solution**:
```bash
# Use a different port
PORT=3001 npm run dev
```

## Health Check Script

Create a quick health check:

```bash
#!/bin/bash
echo "🏥 Odoo Migration Tool Health Check"
echo ""

# Check Node.js
echo -n "Node.js: "
node --version

# Check PostgreSQL
echo -n "PostgreSQL: "
psql --version | head -n 1

# Check config database
echo -n "Config Database: "
psql -U postgres -d odoo_migration_config -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ Connected" || echo "❌ Not accessible"

# Check application
echo -n "Application API: "
curl -s http://localhost:3000/api/connections > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running (start with 'npm run dev')"

echo ""
echo "Done! ✨"
```

Save as `health-check.sh`, make executable, and run:
```bash
chmod +x health-check.sh
./health-check.sh
```

## You're Ready! 🎉

Your migration tool is now running. Next:

1. **Dashboard**: Visit http://localhost:3000/dashboard
2. **Configure**: Add your three database connections (source, staging, target)
3. **Analyze**: Run analysis on source EE database
4. **Export**: Save your critical EE data
5. **Migrate**: Execute on staging database
6. **Validate**: Verify successful migration

## Need Help?

- 📖 Full documentation: `README.md`
- 🔧 Implementation details: `IMPLEMENTATION_SUMMARY.md`
- 💬 API examples: Test with curl commands above

**Happy Migrating! 🚀**
