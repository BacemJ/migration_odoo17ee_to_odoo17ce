"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ConnectionForm from "@/components/migration-wizard/ConnectionForm";
import TableComparisonView from "@/components/migration-wizard/TableComparisonView";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("setup");
  const [refreshConnections, setRefreshConnections] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleConnectionAdded = () => {
    setRefreshConnections((prev) => prev + 1);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisResult(data.data);
      } else {
        setAnalysisError(data.error || "Analysis failed");
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Failed to analyze databases");
    } finally {
      setAnalyzing(false);
    }
  };

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
              <ConnectionForm 
                role="source_ee"
                title="Source Database (Odoo EE)"
                description="Connect to your Odoo 17 Enterprise Edition database (read-only access)"
                onConnectionAdded={handleConnectionAdded} 
              />
              
              <ConnectionForm 
                role="target_ce"
                title="Target Database (Odoo CE)"
                description="Connect to your Odoo 17 Community Edition database (will receive migrated data)"
                onConnectionAdded={handleConnectionAdded} 
              />

              <Card>
                <CardHeader>
                  <CardTitle>Database Analysis & Comparison</CardTitle>
                  <CardDescription>
                    Compare source and target databases to identify differences and compatibility
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={analyzing}
                    className="w-full"
                  >
                    {analyzing ? "Analyzing databases..." : "Analyze & Compare Databases"}
                  </Button>

                  {analysisError && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        ❌ {analysisError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {analyzing && (
                    <div className="text-center space-y-2 py-8">
                      <div className="text-sm text-muted-foreground">
                        ⏳ Analyzing source tables...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Comparing schemas...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Checking compatibility...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {analysisResult && analysisResult.comparison && (
                <TableComparisonView comparison={analysisResult.comparison} />
              )}
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
