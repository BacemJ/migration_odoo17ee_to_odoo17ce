import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Odoo 17 EE to CE Migration Tool
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Safely migrate your Odoo 17 Enterprise Edition database to Community Edition with comprehensive data export, validation, and rollback support.
            </p>
          </div>

          {/* Main CTA */}
          <div className="flex justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8 py-6">
                Launch Migration Wizard
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive analysis of your EE database to identify modules, tables, and dependencies that need migration.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💾</span>
                  Export
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Resumable data export with automatic compression. Preserve critical EE data before migration in module-specific JSON files.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  Migration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Execute migration on staging database with dry-run preview, transaction-based safety, and detailed step logging.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Post-migration validation checks ensure no EE components remain and database integrity is maintained.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔒</span>
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Database credentials encrypted with AES-256 and stored securely. All connections tested before use.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Real-time progress tracking, detailed logs, and comprehensive reporting throughout the migration process.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Architecture Info */}
          <Card className="mt-12">
            <CardHeader>
              <CardTitle>3-Database Architecture</CardTitle>
              <CardDescription>
                Safe migration workflow using isolated database environments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Source EE</h3>
                  <p className="text-sm text-muted-foreground">
                    Production Enterprise database (read-only copy). Used for analysis and export only. Never modified.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Staging</h3>
                  <p className="text-sm text-muted-foreground">
                    Testing ground where migration is executed and validated. Can be reset and retried multiple times.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Target CE</h3>
                  <p className="text-sm text-muted-foreground">
                    Final Community Edition database. Manually copied from validated staging using pgAdmin after successful migration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Before You Begin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Configuration Database</h3>
                <p className="text-sm text-muted-foreground">
                  Create a PostgreSQL database for the migration tool configuration and run the initialization script:
                </p>
                <code className="block mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                  psql -U postgres -c &quot;CREATE DATABASE odoo_migration_config;&quot;<br/>
                  psql -U postgres -d odoo_migration_config -f sql/init-config-db.sql
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Environment Variables</h3>
                <p className="text-sm text-muted-foreground">
                  Update <code>.env.local</code> with your configuration database credentials and generate an encryption key:
                </p>
                <code className="block mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                  node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Database Backups</h3>
                <p className="text-sm text-muted-foreground">
                  Ensure you have complete backups of your production database before starting any migration.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
