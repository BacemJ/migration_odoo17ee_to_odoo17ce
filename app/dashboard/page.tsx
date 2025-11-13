"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("setup");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Migration Wizard</h1>
              <p className="text-muted-foreground">
                Odoo 17 Enterprise to Community Edition Migration
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/">← Back to Home</a>
            </Button>
          </div>

          {/* Migration Workflow Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="migrate">Migrate</TabsTrigger>
              <TabsTrigger value="validate">Validate</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Connections</CardTitle>
                  <CardDescription>
                    Configure your source EE, staging, and target CE database connections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Connection management UI coming soon. This will allow you to configure and test your three database connections.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database Analysis</CardTitle>
                  <CardDescription>
                    Analyze source EE database to identify modules and tables for migration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Analysis interface coming soon. This will scan your source database and display detected EE modules, tables, and estimated export size.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Export</CardTitle>
                  <CardDescription>
                    Export critical EE data to compressed JSON files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Export interface coming soon. This will allow you to export data from modules like helpdesk, subscriptions, documents, planning, etc.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Migrate Tab */}
            <TabsContent value="migrate" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Migration Execution</CardTitle>
                  <CardDescription>
                    Execute migration on staging database
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Migration interface coming soon. This will allow you to run migration in dry-run mode or execute on staging database.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Validate Tab */}
            <TabsContent value="validate" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                  <CardDescription>
                    Post-migration validation checks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Validation interface coming soon. This will display validation check results and migration status.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
