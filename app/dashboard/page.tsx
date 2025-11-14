"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ConnectionForm from "@/components/migration-wizard/ConnectionForm";
import TableComparisonView from "@/components/migration-wizard/TableComparisonView";
import RecordAnalysisView from "@/components/migration-wizard/RecordAnalysisView";

interface TableDetail {
  tableName: string;
  category: 'missing_in_target' | 'identical_records' | 'compatible_diff' | 'incompatible_diff';
  description?: string;
  dataType?: string;
  recordCount?: number;
  sampleRecords?: Array<Record<string, unknown>>;
  sampleColumns?: string[];
  error?: string;
  sourceRecordCount: number;
  targetRecordCount?: number;
  missingColumns?: string[];
  nullOnlyColumns?: string[];
  [key: string]: unknown;
}

interface AnalysisResult {
  comparison?: {
    tablesWithData?: number;
    tablesMissingInTarget?: number;
    tablesWithIdenticalRecords?: number;
    tablesWithCompatibleDiff?: number;
    tablesWithIncompatibleDiff?: number;
    tableDetails?: Array<TableDetail>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface MissingTablesResult {
  tables: TableDetail[];
  groupedByType: {
    business_data: TableDetail[];
    application_configuration: TableDetail[];
    system_configuration: TableDetail[];
    technical: TableDetail[];
  };
  summary: {
    total: number;
    business_data: number;
    application_configuration: number;
    system_configuration: number;
    technical: number;
  };
}

interface RecordAnalysisResult {
  compatibleDiffTables: Array<{
    tableName: string;
    category: 'compatible_diff' | 'incompatible_diff';
    totalRecords: number;
    ceCompatibleRecords: number;
    eeOnlyRecords: number;
    percentageCompatible: number;
    sampleIncompatibleRecords?: Record<string, unknown>[];
    missingColumns?: string[];
  }>;
  incompatibleDiffTables: Array<{
    tableName: string;
    category: 'compatible_diff' | 'incompatible_diff';
    totalRecords: number;
    ceCompatibleRecords: number;
    eeOnlyRecords: number;
    percentageCompatible: number;
    sampleIncompatibleRecords?: Record<string, unknown>[];
    missingColumns?: string[];
  }>;
  summary: {
    totalTablesAnalyzed: number;
    totalCompatibleTables: number;
    totalIncompatibleTables: number;
    totalRecords: number;
    ceCompatibleRecords: number;
    eeOnlyRecords: number;
  };
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("setup");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [recordAnalyzing, setRecordAnalyzing] = useState(false);
  const [recordAnalysisResult, setRecordAnalysisResult] = useState<RecordAnalysisResult | null>(null);
  const [recordAnalysisError, setRecordAnalysisError] = useState<string | null>(null);
  const [missingTablesAnalyzing, setMissingTablesAnalyzing] = useState(false);
  const [missingTablesResult, setMissingTablesResult] = useState<MissingTablesResult | null>(null);
  const [missingTablesError, setMissingTablesError] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const handleConnectionAdded = () => {
    // Connection added callback - triggers re-render of connection forms
  };

  // Load last analysis results on component mount
  useEffect(() => {
    const loadLastAnalysis = async () => {
      try {
        const response = await fetch("/api/analyze?latest=true");
        const data = await response.json();

        if (data.success && data.data) {
          setAnalysisResult(data.data);
        }
      } catch (error) {
        console.error("Failed to load last analysis:", error);
        // Silently fail - user can run new analysis
      }
    };

    loadLastAnalysis();
  }, []);

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

  const handleRecordAnalysis = async () => {
    setRecordAnalyzing(true);
    setRecordAnalysisError(null);
    setRecordAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        setRecordAnalysisResult(data.data);
      } else {
        setRecordAnalysisError(data.error || "Record analysis failed");
      }
    } catch (error) {
      setRecordAnalysisError(error instanceof Error ? error.message : "Failed to analyze records");
    } finally {
      setRecordAnalyzing(false);
    }
  };

  const handleMissingTablesAnalysis = async () => {
    if (!analysisResult?.comparison?.tableDetails) {
      setMissingTablesError("Please run table comparison first");
      return;
    }

    setMissingTablesAnalyzing(true);
    setMissingTablesError(null);
    setMissingTablesResult(null);

    try {
      const missingTables = analysisResult.comparison.tableDetails.filter(
        (t: TableDetail) => t.category === 'missing_in_target'
      );

      const response = await fetch("/api/deep-analysis/missing-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missingTables }),
      });

      const data = await response.json();

      if (data.success) {
        setMissingTablesResult(data.data);
      } else {
        setMissingTablesError(data.error || "Missing tables analysis failed");
      }
    } catch (error) {
      setMissingTablesError(error instanceof Error ? error.message : "Failed to analyze missing tables");
    } finally {
      setMissingTablesAnalyzing(false);
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
              <Link href="/">← Back to Home</Link>
            </Button>
          </div>

          {/* Migration Workflow Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="deep-analysis">Deep Analysis</TabsTrigger>
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
                  <TableComparisonView
                    comparison={{
                      ...analysisResult.comparison,
                      tablesWithData: typeof analysisResult.comparison.tablesWithData === "number" ? analysisResult.comparison.tablesWithData : 0,
                      tablesMissingInTarget: typeof analysisResult.comparison.tablesMissingInTarget === "number" ? analysisResult.comparison.tablesMissingInTarget : 0,
                      tablesWithIdenticalRecords: typeof analysisResult.comparison.tablesWithIdenticalRecords === "number" ? analysisResult.comparison.tablesWithIdenticalRecords : 0,
                      tablesWithCompatibleDiff: typeof analysisResult.comparison.tablesWithCompatibleDiff === "number" ? analysisResult.comparison.tablesWithCompatibleDiff : 0,
                      tablesWithIncompatibleDiff: typeof analysisResult.comparison.tablesWithIncompatibleDiff === "number" ? analysisResult.comparison.tablesWithIncompatibleDiff : 0,
                      tableDetails: Array.isArray(analysisResult.comparison.tableDetails) ? analysisResult.comparison.tableDetails : [],
                    }}
                  />
                )}
            </TabsContent>

            {/* Deep Analysis Tab */}
            <TabsContent value="deep-analysis" className="space-y-6">
              {/* Step 1: Missing Tables Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Data Loss Analysis</CardTitle>
                  <CardDescription>
                    Identify tables that will be completely lost during migration (missing in target CE database)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertDescription>
                      ⚠️ <strong>Critical:</strong> These tables exist in your EE database but do not exist in CE. All data in these tables will be permanently lost unless exported beforehand.
                    </AlertDescription>
                  </Alert>

                  {!analysisResult && (
                    <Alert>
                      <AlertDescription>
                        Please run the table comparison analysis first (Setup tab).
                      </AlertDescription>
                    </Alert>
                  )}

                  {analysisResult && (
                    <>
                      <Button 
                        onClick={handleMissingTablesAnalysis} 
                        disabled={missingTablesAnalyzing}
                        className="w-full"
                      >
                        {missingTablesAnalyzing ? "Analyzing missing tables..." : "Analyze Missing Tables & Preview Data"}
                      </Button>

                      {missingTablesError && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            ❌ {missingTablesError}
                          </AlertDescription>
                        </Alert>
                      )}

                      {missingTablesAnalyzing && (
                        <div className="text-center space-y-2 py-8">
                          <div className="text-sm text-muted-foreground">
                            ⏳ Classifying table data types...
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ⏳ Extracting sample records...
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ⏳ Analyzing non-null columns...
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {missingTablesResult && (
                <>
                  {/* Summary Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Missing Tables Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-red-100 dark:bg-red-950 rounded-lg">
                          <div className="text-3xl font-bold text-red-600">
                            {missingTablesResult.summary.business_data}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Business Data Tables
                          </div>
                        </div>
                        <div className="text-center p-4 bg-orange-100 dark:bg-orange-950 rounded-lg">
                          <div className="text-3xl font-bold text-orange-600">
                            {missingTablesResult.summary.application_configuration}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            App Configuration
                          </div>
                        </div>
                        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
                          <div className="text-3xl font-bold text-yellow-600">
                            {missingTablesResult.summary.system_configuration}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            System Configuration
                          </div>
                        </div>
                        <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          <div className="text-3xl font-bold text-slate-600">
                            {missingTablesResult.summary.technical}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Technical Tables
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Business Data Tables */}
                  {missingTablesResult.groupedByType.business_data.length > 0 && (
                    <Card className="border-red-300">
                      <CardHeader className="bg-red-50 dark:bg-red-950">
                        <CardTitle className="text-red-700 dark:text-red-300">
                          🚨 Business Data Tables ({missingTablesResult.groupedByType.business_data.length})
                        </CardTitle>
                        <CardDescription>
                          Critical: These tables contain customer/business data that will be permanently lost
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          {missingTablesResult.groupedByType.business_data.map((table: TableDetail, idx: number) => (
                            <Card key={idx} className="border-red-200">
                              <CardHeader className="cursor-pointer" onClick={() => setExpandedTable(expandedTable === table.tableName ? null : table.tableName)}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-base">{table.tableName}</CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                      {table.description} • {(table.recordCount || 0).toLocaleString()} records
                                    </CardDescription>
                                  </div>
                                  <Button variant="ghost" size="sm">
                                    {expandedTable === table.tableName ? "▼ Hide" : "▶ Show Data"}
                                  </Button>
                                </div>
                              </CardHeader>
                              {expandedTable === table.tableName && (
                                <CardContent>
                                  {table.sampleRecords && table.sampleRecords.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <div className="text-xs text-muted-foreground mb-2">
                                        Showing first {table.sampleRecords.length} records (non-null columns only)
                                      </div>
                                      <table className="w-full text-xs border">
                                        <thead>
                                          <tr className="bg-slate-100 dark:bg-slate-800">
                                            {table.sampleColumns?.map((col: string, i: number) => (
                                              <th key={i} className="border p-2 text-left font-medium">
                                                {col}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {table.sampleRecords.slice(0, 20).map((record: Record<string, unknown>, rowIdx: number) => (
                                            <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                              {table.sampleColumns?.map((col: string, colIdx: number) => (
                                                <td key={colIdx} className="border p-2">
                                                  {record[col] !== null && record[col] !== undefined
                                                    ? String(record[col]).substring(0, 100)
                                                    : '-'}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <Alert>
                                      <AlertDescription>
                                        No data available or error loading sample records
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Application Configuration Tables */}
                  {missingTablesResult.groupedByType.application_configuration.length > 0 && (
                    <Card className="border-orange-300">
                      <CardHeader className="bg-orange-50 dark:bg-orange-950">
                        <CardTitle className="text-orange-700 dark:text-orange-300">
                          ⚙️ Application Configuration Tables ({missingTablesResult.groupedByType.application_configuration.length})
                        </CardTitle>
                        <CardDescription>
                          Application settings and configurations that may need manual recreation
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          {missingTablesResult.groupedByType.application_configuration.map((table: TableDetail, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded border">
                              <div>
                                <div className="font-medium text-sm">{table.tableName}</div>
                                <div className="text-xs text-muted-foreground">{table.description}</div>
                              </div>
                              <div className="text-sm font-semibold">{table.recordCount} records</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* System Configuration Tables */}
                  {missingTablesResult.groupedByType.system_configuration.length > 0 && (
                    <Card className="border-yellow-300">
                      <CardHeader className="bg-yellow-50 dark:bg-yellow-950">
                        <CardTitle className="text-yellow-700 dark:text-yellow-300">
                          🔧 System Configuration Tables ({missingTablesResult.groupedByType.system_configuration.length})
                        </CardTitle>
                        <CardDescription>
                          System-level settings (IoT, VoIP, etc.)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          {missingTablesResult.groupedByType.system_configuration.map((table: TableDetail, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded border">
                              <div>
                                <div className="font-medium text-sm">{table.tableName}</div>
                                <div className="text-xs text-muted-foreground">{table.description}</div>
                              </div>
                              <div className="text-sm font-semibold">{table.recordCount} records</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Technical Tables */}
                  {missingTablesResult.groupedByType.technical.length > 0 && (
                    <Card className="border-slate-300">
                      <CardHeader className="bg-slate-50 dark:bg-slate-900">
                        <CardTitle className="text-slate-700 dark:text-slate-300">
                          🔩 Technical Tables ({missingTablesResult.groupedByType.technical.length})
                        </CardTitle>
                        <CardDescription>
                          Relation tables and temporary data (usually safe to ignore)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          {missingTablesResult.groupedByType.technical.map((table: TableDetail, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded border">
                              <div>
                                <div className="font-medium text-sm">{table.tableName}</div>
                                <div className="text-xs text-muted-foreground">{table.description}</div>
                              </div>
                              <div className="text-sm font-semibold">{table.recordCount} records</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Record Compatibility Analysis</CardTitle>
                  <CardDescription>
                    Analyze tables with differences to identify CE-compatible vs EE-only records
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      This analysis examines tables with compatible and incompatible differences to determine which records can be migrated to Odoo CE and which contain EE-only data.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={handleRecordAnalysis} 
                    disabled={recordAnalyzing || !analysisResult}
                    className="w-full"
                  >
                    {recordAnalyzing ? "Analyzing records..." : "Analyze Record Compatibility"}
                  </Button>

                  {!analysisResult && (
                    <Alert>
                      <AlertDescription>
                        Please run the table comparison analysis first (Setup tab).
                      </AlertDescription>
                    </Alert>
                  )}

                  {recordAnalysisError && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        ❌ {recordAnalysisError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {recordAnalyzing && (
                    <div className="text-center space-y-2 py-8">
                      <div className="text-sm text-muted-foreground">
                        ⏳ Analyzing compatible tables...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Analyzing incompatible tables...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Identifying EE-only records...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {recordAnalysisResult && (
                <RecordAnalysisView analysis={recordAnalysisResult} />
              )}
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
