"use client";

import IncompatibleFieldsView, { FieldDataLossAnalysis, IncompatibleFieldsSummary } from "@/components/migration-wizard/IncompatibleFieldsView";
import { EEAnalysisView } from "@/components/migration-wizard/EEAnalysisView";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
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
  const [sourceConnectionId, setSourceConnectionId] = useState<number | null>(null);
  const [targetConnectionId, setTargetConnectionId] = useState<number | null>(null);
  const [sourceConnectionName, setSourceConnectionName] = useState<string | null>(null);
  const [targetConnectionName, setTargetConnectionName] = useState<string | null>(null);

  // Step 2: Incompatible Fields Analysis state and handler (must be inside component)
  const [incompatibleFieldsAnalyzing, setIncompatibleFieldsAnalyzing] = useState(false);
  const [incompatibleFieldsResult, setIncompatibleFieldsResult] = useState<{
    analysis: FieldDataLossAnalysis[];
    summary: IncompatibleFieldsSummary;
  } | null>(null);
  const [incompatibleFieldsError, setIncompatibleFieldsError] = useState<string | null>(null);

  // EE Analysis state
  const [eeAnalyzing, setEEAnalyzing] = useState(false);
  const [eeAnalysisResult, setEEAnalysisResult] = useState<any>(null);
  const [eeAnalysisError, setEEAnalysisError] = useState<string | null>(null);

  // Full Analyze - View Records Modal state
  const [fullAnalyzeRecordsLoading, setFullAnalyzeRecordsLoading] = useState(false);
  const [fullAnalyzeRecordsError, setFullAnalyzeRecordsError] = useState<string | null>(null);
  const [fullAnalyzeRecordsData, setFullAnalyzeRecordsData] = useState<{
    tableName: string;
    totalIncompatible: number;
    returned: number;
    columns: string[];
    records: Record<string, unknown>[];
  } | null>(null);
  const [fullAnalyzeOpenTable, setFullAnalyzeOpenTable] = useState<string | null>(null);

  const loadFullAnalyzeIncompatibleRecords = async (tableName: string) => {
    setFullAnalyzeOpenTable(tableName);
    setFullAnalyzeRecordsLoading(true);
    setFullAnalyzeRecordsError(null);
    setFullAnalyzeRecordsData(null);
    try {
      const res = await fetch('/api/ee-analysis/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionName: sourceConnectionName, tableName, limit: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        setFullAnalyzeRecordsData(data.data);
      } else {
        setFullAnalyzeRecordsError(data.error || 'Failed to load incompatible records');
      }
    } catch (err) {
      setFullAnalyzeRecordsError(err instanceof Error ? err.message : 'Failed to load incompatible records');
    } finally {
      setFullAnalyzeRecordsLoading(false);
    }
  };

  const handleEEAnalysis = async () => {
    setEEAnalyzing(true);
    setEEAnalysisError(null);
    setEEAnalysisResult(null);

    try {
      if (!sourceConnectionName) {
        setEEAnalysisError("Source database connection (name) is not configured. Please set up connections in the Setup tab.");
        setEEAnalyzing(false);
        return;
      }

      const response = await fetch('/api/ee-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionName: sourceConnectionName }),
      });

      const data = await response.json();

      if (data.success) {
        setEEAnalysisResult(data.data);
      } else {
        setEEAnalysisError(data.error || "EE analysis failed");
      }
    } catch (error) {
      setEEAnalysisError(error instanceof Error ? error.message : "Failed to run EE analysis");
    } finally {
      setEEAnalyzing(false);
    }
  };

  const handleIncompatibleFieldsAnalysis = async () => {
    setIncompatibleFieldsAnalyzing(true);
    setIncompatibleFieldsError(null);
    setIncompatibleFieldsResult(null);

    try {
      // Always fetch the latest analysis result from the backend
      const analysisRes = await fetch("/api/analyze?latest=true");
      const analysisData = await analysisRes.json();
      const latestAnalysis = analysisData?.data;

      // Debug logging
      console.log('Analysis data:', analysisData);
      console.log('Latest analysis:', latestAnalysis);
      console.log('Source connection Name:', sourceConnectionName);
      console.log('Target connection Name:', targetConnectionName);
      console.log('Table details:', latestAnalysis?.comparison?.tableDetails);

      // Detailed error checking
      if (!latestAnalysis) {
        setIncompatibleFieldsError("No analysis results found. Please run table comparison first (Setup tab).");
        setIncompatibleFieldsAnalyzing(false);
        return;
      }

      if (!latestAnalysis.comparison) {
        setIncompatibleFieldsError("Analysis comparison data is missing. Please run table comparison again.");
        setIncompatibleFieldsAnalyzing(false);
        return;
      }

      if (!latestAnalysis.comparison.tableDetails || !Array.isArray(latestAnalysis.comparison.tableDetails)) {
        setIncompatibleFieldsError("Table details are missing or invalid. Please run table comparison again.");
        setIncompatibleFieldsAnalyzing(false);
        return;
      }

      if (!sourceConnectionName || !targetConnectionName) {
        setIncompatibleFieldsError("Database connections are not configured. Please set up connections in the Setup tab.");
        setIncompatibleFieldsAnalyzing(false);
        return;
      }

      // Get tables with incompatible differences and their missing columns
      const incompatibleTables = latestAnalysis.comparison.tableDetails
        .filter((t: TableDetail) => t.category === 'incompatible_diff' && t.missingColumns && t.missingColumns.length > 0)
        .map((t: TableDetail) => ({
          tableName: t.tableName,
          missingColumns: t.missingColumns || [],
        }));

      if (incompatibleTables.length === 0) {
        setIncompatibleFieldsError("No tables with incompatible fields found.");
        setIncompatibleFieldsAnalyzing(false);
        return;
      }

      // Call the API
      const params = new URLSearchParams({
        sourceName: String(sourceConnectionName),
        targetName: String(targetConnectionName),
        incompatibleTables: JSON.stringify(incompatibleTables),
      });
      const response = await fetch(`/api/deep-analysis/incompatible-fields?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setIncompatibleFieldsResult({
          analysis: data.analysis,
          summary: data.summary,
        });
      } else {
        setIncompatibleFieldsError(data.error || "Incompatible fields analysis failed");
      }
    } catch (error) {
      setIncompatibleFieldsError(error instanceof Error ? error.message : "Failed to analyze incompatible fields");
    } finally {
      setIncompatibleFieldsAnalyzing(false);
    }
  };

  const handleConnectionAdded = () => {
    // Connection added callback - triggers re-render of connection forms
  };

  // Load last analysis results and connection IDs on component mount
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

    const loadConnectionIds = async () => {
      try {
        const response = await fetch("/api/connections");
        const data = await response.json();
        
        console.log("Connections API response:", data);
        
        if (data.success && data.data) {
          const sourceConn = data.data.find((c: { role: string }) => c.role === 'source_ee');
          const targetConn = data.data.find((c: { role: string }) => c.role === 'target_ce');
          
          console.log("Source connection:", sourceConn);
          console.log("Target connection:", targetConn);
          
          if (sourceConn) {
            setSourceConnectionId(sourceConn.id);
            setSourceConnectionName(sourceConn.name);
          }
          if (targetConn) {
            setTargetConnectionId(targetConn.id);
            setTargetConnectionName(targetConn.name);
          }
        }
      } catch (error) {
        console.error("Failed to load connection IDs:", error);
      }
    };

    loadLastAnalysis();
    loadConnectionIds();
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
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="deep-analysis">Deep Analysis</TabsTrigger>
              <TabsTrigger value="ee-analysis">EE Analysis</TabsTrigger>
              <TabsTrigger value="full-analyze">Full Analyze</TabsTrigger>
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
                    sourceId={sourceConnectionId || undefined}
                    targetId={targetConnectionId || undefined}
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

              {/* Step 2: Incompatible Fields Analysis */}

              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Incompatible Fields Analysis</CardTitle>
                  <CardDescription>
                    Analyze data loss in fields that exist in EE but not in CE (for tables that exist in both)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Warning:</strong> Some tables exist in both EE and CE but have additional fields in EE. Data in these EE-only fields will be lost during migration.
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
                        onClick={handleIncompatibleFieldsAnalysis}
                        disabled={incompatibleFieldsAnalyzing}
                        className="w-full"
                      >
                        {incompatibleFieldsAnalyzing ? "Analyzing incompatible fields..." : "Analyze Incompatible Fields & Preview Data"}
                      </Button>

                      {incompatibleFieldsError && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            ❌ {incompatibleFieldsError}
                          </AlertDescription>
                        </Alert>
                      )}

                      {incompatibleFieldsAnalyzing && (
                        <div className="text-center space-y-2 py-8">
                          <div className="text-sm text-muted-foreground">
                            ⏳ Grouping tables by business/config/technical...
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ⏳ Extracting sample records and field data loss...
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {incompatibleFieldsResult && (
                    <IncompatibleFieldsView
                      analysis={incompatibleFieldsResult.analysis}
                      summary={incompatibleFieldsResult.summary}
                    />
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            {/* Full Analyze Tab */}
            <TabsContent value="full-analyze" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Comprehensive Migration Analysis</CardTitle>
                  <CardDescription>
                    Complete analysis combining all migration checks, data loss assessment, and compatibility reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      This performs a full analysis combining table comparison, missing tables detection, incompatible fields analysis, EE-specific features detection, and record-level compatibility checks.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={handleAnalyze} 
                      disabled={analyzing}
                      className="w-full"
                    >
                      {analyzing ? "Analyzing..." : "1. Run Table Comparison"}
                    </Button>

                    <Button 
                      onClick={handleMissingTablesAnalysis} 
                      disabled={missingTablesAnalyzing || !analysisResult}
                      className="w-full"
                    >
                      {missingTablesAnalyzing ? "Analyzing..." : "2. Analyze Missing Tables"}
                    </Button>

                    <Button 
                      onClick={handleIncompatibleFieldsAnalysis} 
                      disabled={incompatibleFieldsAnalyzing || !analysisResult}
                      className="w-full"
                    >
                      {incompatibleFieldsAnalyzing ? "Analyzing..." : "3. Analyze Incompatible Fields"}
                    </Button>

                    <Button 
                      onClick={handleEEAnalysis} 
                      disabled={eeAnalyzing || !sourceConnectionName}
                      className="w-full"
                    >
                      {eeAnalyzing ? "Analyzing..." : "4. Run EE Analysis"}
                    </Button>

                    <Button 
                      onClick={handleRecordAnalysis} 
                      disabled={recordAnalyzing || !analysisResult}
                      className="w-full"
                    >
                      {recordAnalyzing ? "Analyzing..." : "5. Analyze Record Compatibility"}
                    </Button>
                  </div>

                  {(analyzing || missingTablesAnalyzing || incompatibleFieldsAnalyzing || eeAnalyzing || recordAnalyzing) && (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                      <p className="text-sm text-muted-foreground">Running comprehensive analysis...</p>
                    </div>
                  )}

                  {(analysisError || missingTablesError || incompatibleFieldsError || eeAnalysisError || recordAnalysisError) && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {analysisError || missingTablesError || incompatibleFieldsError || eeAnalysisError || recordAnalysisError}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Merged: Incompatible Fields + EE Analysis */}
              {incompatibleFieldsResult && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>📋 Incompatible Tables - Comprehensive Analysis</CardTitle>
                      <CardDescription>
                        Combined view: Field-level data loss analysis + EE-specific feature incompatibilities
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Alert className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This section shows tables with incompatible differences, merging field-level analysis with EE-specific incompatibilities detected.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {/* Show each incompatible table with merged data */}
                  {incompatibleFieldsResult.analysis.map((table, idx) => {
                    const eeTableData = eeAnalysisResult?.results?.find(
                      (r: { tableName: string }) => r.tableName === `public.${table.tableName}` || r.tableName === table.tableName
                    );

                    return (
                      <Card key={idx} className="border-l-4 border-l-red-500">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg font-mono">{table.tableName}</CardTitle>
                              <CardDescription className="mt-1">{table.dataType.description}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={
                                table.dataType.category === 'business_data' ? 'destructive' :
                                table.dataType.category === 'application_configuration' ? 'default' :
                                'secondary'
                              }>
                                {table.dataType.category.replace('_', ' ')}
                              </Badge>
                              {eeTableData && eeTableData.incompatibleRecords > 0 && sourceConnectionName && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => loadFullAnalyzeIncompatibleRecords(eeTableData.tableName)}
                                >
                                  View EE Records
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Field-Level Data Loss */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-red-50 border border-red-200 rounded">
                            <div>
                              <div className="text-sm text-muted-foreground">Total Records</div>
                              <div className="text-2xl font-bold">{table.totalRecordsInTable.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Records with Data Loss</div>
                              <div className="text-2xl font-bold text-red-700">{table.recordsWithDataLoss.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Missing Columns</div>
                              <div className="text-2xl font-bold text-red-700">{table.missingColumns.length}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Impact</div>
                              <div className="text-2xl font-bold text-red-700">
                                {((table.recordsWithDataLoss / table.totalRecordsInTable) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* EE Analysis Data (if available) */}
                          {eeTableData && (
                            <div className="p-4 bg-purple-50 border border-purple-200 rounded">
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-purple-900">
                                  🔍 EE-Specific Features Analysis
                                </div>
                                {eeTableData.incompatibleRecords > 0 && sourceConnectionName && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => loadFullAnalyzeIncompatibleRecords(eeTableData.tableName)}
                                    className="text-xs"
                                  >
                                    View Records
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <div className="text-xs text-muted-foreground">EE Incompatible Records</div>
                                  <div className="text-xl font-bold text-purple-900">{eeTableData.incompatibleRecords?.toLocaleString() || 0}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">EE Impact</div>
                                  <div className="text-xl font-bold text-purple-900">{eeTableData.percentageIncompatible?.toFixed(1) || 0}%</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Risk Level</div>
                                  <div className={`text-lg font-bold uppercase ${
                                    eeTableData.riskLevel === 'critical' ? 'text-red-600' :
                                    eeTableData.riskLevel === 'high' ? 'text-orange-600' :
                                    eeTableData.riskLevel === 'medium' ? 'text-yellow-600' :
                                    'text-blue-600'
                                  }`}>{eeTableData.riskLevel || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Table Role</div>
                                  <div className="text-lg font-bold capitalize">{eeTableData.tableRole || 'N/A'}</div>
                                </div>
                              </div>
                              {eeTableData.migrationAction && (
                                <div className="mt-3 p-2 bg-purple-100 rounded text-sm">
                                  <span className="font-semibold">Migration Action:</span>
                                  <span className="ml-2">{eeTableData.migrationAction}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Missing Columns Details */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Missing Columns in CE:</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {table.missingColumns.map((col, colIdx) => (
                                <div key={colIdx} className="p-3 bg-white border rounded">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-sm font-bold">{col.columnName}</span>
                                    <Badge variant={col.isBusinessCritical ? 'destructive' : 'secondary'} className="text-xs">
                                      {col.isBusinessCritical ? 'Critical' : col.dataType}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {col.recordsWithData.toLocaleString()} records affected
                                  </div>
                                  {col.sampleValues && col.sampleValues.length > 0 && (
                                    <div className="mt-2 text-xs">
                                      <span className="text-muted-foreground">Sample: </span>
                                      <span className="font-mono">{String(col.sampleValues[0])}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Sample Records */}
                          {table.sampleRecords && table.sampleRecords.length > 0 && (
                            <details className="group">
                              <summary className="cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100 font-semibold text-sm">
                                View Sample Records ({table.sampleRecords.length})
                              </summary>
                              <div className="mt-2 overflow-x-auto border rounded">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      {Object.keys(table.sampleRecords[0])
                                        .filter(key => key !== '_missingInCE')
                                        .map((key, i) => (
                                          <th key={i} className="p-2 text-left font-mono border-b">
                                            <span className={
                                              table.sampleRecords[0]._missingInCE?.includes(key) 
                                                ? 'text-red-600 font-bold' 
                                                : ''
                                            }>
                                              {key}
                                            </span>
                                          </th>
                                        ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.sampleRecords.slice(0, 5).map((record, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-gray-50">
                                        {Object.entries(record)
                                          .filter(([key]) => key !== '_missingInCE')
                                          .map(([key, value], cIdx) => (
                                            <td 
                                              key={cIdx} 
                                              className={`p-2 border-b font-mono ${
                                                record._missingInCE?.includes(key)
                                                  ? 'bg-red-50 text-red-800 font-bold border-l-2 border-l-red-500'
                                                  : ''
                                              }`}
                                            >
                                              {value === null || value === undefined ? (
                                                <span className="text-gray-400 italic">null</span>
                                              ) : (
                                                String(value).substring(0, 50)
                                              )}
                                            </td>
                                          ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}

              {recordAnalysisResult && recordAnalysisResult.compatibleDiffTables && recordAnalysisResult.compatibleDiffTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tables with Compatible Differences</CardTitle>
                    <CardDescription>
                      Tables that exist in both EE and CE but have structural differences - enhanced with EE-specific data analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recordAnalysisResult.compatibleDiffTables.map((table, idx) => {
                        // Find matching EE analysis data for this table
                        const eeTableData = eeAnalysisResult?.results?.find(
                          (r: { tableName: string }) => r.tableName === `public.${table.tableName}` || r.tableName === table.tableName
                        );
                        
                        return (
                          <Card key={idx} className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-mono">{table.tableName}</CardTitle>
                                <div className="flex gap-2">
                                  {table.percentageCompatible >= 90 ? (
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">High Compatibility</span>
                                  ) : table.percentageCompatible >= 70 ? (
                                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Medium Compatibility</span>
                                  ) : (
                                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">Low Compatibility</span>
                                  )}
                                  {eeTableData && eeTableData.incompatibleRecords > 0 && sourceConnectionName && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => loadFullAnalyzeIncompatibleRecords(eeTableData.tableName)}
                                    >
                                      View EE Records
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="text-center p-3 bg-gray-50 rounded">
                                  <div className="text-xl font-bold">{table.totalRecords.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">Total Records</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded">
                                  <div className="text-xl font-bold text-green-700">{table.ceCompatibleRecords.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">CE Compatible</div>
                                </div>
                                <div className="text-center p-3 bg-red-50 rounded">
                                  <div className="text-xl font-bold text-red-700">{table.eeOnlyRecords.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">EE Only</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded">
                                  <div className="text-xl font-bold text-blue-700">{table.percentageCompatible.toFixed(1)}%</div>
                                  <div className="text-xs text-muted-foreground">Compatible</div>
                                </div>
                              </div>

                              {eeTableData && (
                                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-semibold text-purple-900">🔍 EE-Specific Features Detected</div>
                                    {eeTableData.incompatibleRecords > 0 && sourceConnectionName && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => loadFullAnalyzeIncompatibleRecords(eeTableData.tableName)}
                                        className="text-xs h-7"
                                      >
                                        View Records
                                      </Button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Incompatible Records:</span>
                                      <span className="ml-2 font-bold text-destructive">{eeTableData.incompatibleRecords?.toLocaleString() || 0}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Impact:</span>
                                      <span className="ml-2 font-bold">{eeTableData.percentageIncompatible?.toFixed(1) || 0}%</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Risk Level:</span>
                                      <span className={`ml-2 font-bold uppercase ${
                                        eeTableData.riskLevel === 'critical' ? 'text-red-600' :
                                        eeTableData.riskLevel === 'high' ? 'text-orange-600' :
                                        eeTableData.riskLevel === 'medium' ? 'text-yellow-600' :
                                        'text-blue-600'
                                      }`}>{eeTableData.riskLevel || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Table Role:</span>
                                      <span className="ml-2 font-bold capitalize">{eeTableData.tableRole || 'N/A'}</span>
                                    </div>
                                  </div>
                                  {eeTableData.migrationAction && (
                                    <div className="mt-2 text-xs">
                                      <span className="text-muted-foreground">Migration Action:</span>
                                      <span className="ml-2 italic">{eeTableData.migrationAction}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {table.missingColumns && table.missingColumns.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-sm font-semibold mb-1">Missing Columns in CE:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {table.missingColumns.map((col: string, colIdx: number) => (
                                      <span key={colIdx} className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-mono">
                                        {col}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Incompatible Records Modal for Full Analyze */}
              {fullAnalyzeOpenTable && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                  <div className="bg-background rounded-lg border shadow-lg w-full max-w-5xl max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div>
                        <h2 className="font-semibold text-lg">EE Incompatible Records: {fullAnalyzeOpenTable.replace('public.', '')}</h2>
                        {fullAnalyzeRecordsData && (
                          <p className="text-sm text-muted-foreground">
                            Showing {fullAnalyzeRecordsData.returned} of {fullAnalyzeRecordsData.totalIncompatible.toLocaleString()} incompatible rows
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => { setFullAnalyzeOpenTable(null); setFullAnalyzeRecordsData(null); setFullAnalyzeRecordsError(null); }}
                        className="rounded px-2 py-1 text-sm hover:bg-muted"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-4 overflow-auto flex-1">
                      {fullAnalyzeRecordsLoading && (
                        <div className="text-center py-10 text-sm text-muted-foreground">Loading incompatible records...</div>
                      )}
                      {fullAnalyzeRecordsError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{fullAnalyzeRecordsError}</AlertDescription>
                        </Alert>
                      )}
                      {fullAnalyzeRecordsData && fullAnalyzeRecordsData.records.length === 0 && !fullAnalyzeRecordsLoading && (
                        <div className="text-center py-10 text-sm text-muted-foreground">No incompatible records found.</div>
                      )}
                      {fullAnalyzeRecordsData && fullAnalyzeRecordsData.records.length > 0 && (
                        <div className="border rounded overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {fullAnalyzeRecordsData.columns.map(col => (
                                  <th key={col} className="p-2 text-left font-mono border-b whitespace-nowrap">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fullAnalyzeRecordsData.records.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  {fullAnalyzeRecordsData.columns.map(col => (
                                    <td key={col} className="p-2 font-mono border-b whitespace-nowrap max-w-60 overflow-hidden text-ellipsis">
                                      {row[col] === null || row[col] === undefined ? (
                                        <span className="text-gray-400 italic">null</span>
                                      ) : (
                                        String(row[col])
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t flex justify-between items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {fullAnalyzeRecordsData && fullAnalyzeRecordsData.totalIncompatible > fullAnalyzeRecordsData.returned && 'Display limited to first 50 rows.'}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadFullAnalyzeIncompatibleRecords(fullAnalyzeOpenTable)}
                          disabled={fullAnalyzeRecordsLoading}
                        >
                          Refresh
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setFullAnalyzeOpenTable(null); setFullAnalyzeRecordsData(null); setFullAnalyzeRecordsError(null); }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* EE Analysis Tab */}
            <TabsContent value="ee-analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Enterprise Edition Incompatibility Analysis</CardTitle>
                  <CardDescription>
                    Analyze EE-specific data that will become incompatible when migrating to CE
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertDescription>
                      ⚠️ <strong>Important:</strong> This analysis identifies records in your EE database that use EE-only features. These records may lose functionality or data during migration to CE.
                    </AlertDescription>
                  </Alert>

                  {!sourceConnectionId && (
                    <Alert>
                      <AlertDescription>
                        Please configure the source database connection in the Setup tab first.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleEEAnalysis}
                    disabled={eeAnalyzing || !sourceConnectionId}
                    className="w-full"
                  >
                    {eeAnalyzing ? "Analyzing..." : "Run EE Incompatibility Analysis"}
                  </Button>

                  {eeAnalysisError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{eeAnalysisError}</AlertDescription>
                    </Alert>
                  )}

                  {eeAnalyzing && (
                    <div className="text-center space-y-2 py-8">
                      <div className="text-sm text-muted-foreground">
                        ⏳ Connecting to source database...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Executing incompatibility detection queries...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ⏳ Analyzing record-level incompatibilities...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {eeAnalysisResult && (
                <EEAnalysisView summary={eeAnalysisResult} loading={eeAnalyzing} sourceConnectionName={sourceConnectionName || undefined} />
              )}
            </TabsContent>


          </Tabs>
        </div>
      </div>
    </div>
  );
}
