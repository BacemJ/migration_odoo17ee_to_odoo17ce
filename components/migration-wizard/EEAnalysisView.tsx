import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

interface IncompatibilityResult {
  tableName: string;
  totalRecords: number;
  incompatibleRecords: number;
  percentageIncompatible: number;
  hasDetectionMethod: boolean;
  riskLevel?: string;
  tableRole?: string;
  migrationAction?: string;
  error?: string;
}

interface EEAnalysisSummary {
  totalTables: number;
  tablesWithDetectionMethods: number;
  totalRecordsScanned: number;
  totalIncompatibleRecords: number;
  overallPercentageIncompatible: number;
  byRiskLevel: Record<string, { tables: number; incompatibleRecords: number }>;
  results: IncompatibilityResult[];
}

interface EEAnalysisViewProps {
  summary: EEAnalysisSummary;
  loading?: boolean;
  sourceConnectionName?: string;
}

const getRiskLevelColor = (riskLevel: string) => {
  switch (riskLevel.toLowerCase()) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getRiskLevelIcon = (riskLevel: string) => {
  switch (riskLevel.toLowerCase()) {
    case 'critical':
      return <XCircle className="h-4 w-4" />;
    case 'high':
      return <AlertCircle className="h-4 w-4" />;
    case 'medium':
      return <AlertTriangle className="h-4 w-4" />;
    case 'low':
      return <Info className="h-4 w-4" />;
    default:
      return null;
  }
};

export function EEAnalysisView({ summary, loading, sourceConnectionName }: EEAnalysisViewProps) {
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [recordsData, setRecordsData] = useState<{
    tableName: string;
    totalIncompatible: number;
    returned: number;
    columns: string[];
    records: Record<string, unknown>[];
  } | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(null);

  const loadIncompatibleRecords = async (tableName: string) => {
    setOpenTable(tableName);
    setRecordsLoading(true);
    setRecordsError(null);
    setRecordsData(null);
    try {
      const res = await fetch('/api/ee-analysis/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionName: sourceConnectionName, tableName, limit: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        setRecordsData(data.data);
      } else {
        setRecordsError(data.error || 'Failed to load incompatible records');
      }
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : 'Failed to load incompatible records');
    } finally {
      setRecordsLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing incompatibilities...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No analysis results available. Please run the analysis first.
        </AlertDescription>
      </Alert>
    );
  }

  // Group results by risk level
  const resultsByRisk: Record<string, IncompatibilityResult[]> = {};
  summary.results.forEach((result) => {
    const risk = result.riskLevel || 'low';
    if (!resultsByRisk[risk]) resultsByRisk[risk] = [];
    resultsByRisk[risk].push(result);
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tables Analyzed</CardDescription>
            <CardTitle className="text-3xl">{summary.totalTables}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {summary.tablesWithDetectionMethods} with detection methods
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Records Scanned</CardDescription>
            <CardTitle className="text-3xl">{summary.totalRecordsScanned.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Incompatible Records</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {summary.totalIncompatibleRecords.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Overall Impact</CardDescription>
            <CardTitle className="text-3xl">
              {summary.overallPercentageIncompatible.toFixed(2)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={summary.overallPercentageIncompatible} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Risk Level Summary */}
      {Object.keys(summary.byRiskLevel).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Impact by Risk Level</CardTitle>
            <CardDescription>Distribution of incompatible records across risk categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(summary.byRiskLevel)
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a[0] as keyof typeof order] || 99) - (order[b[0] as keyof typeof order] || 99);
                })
                .map(([level, data]) => (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getRiskLevelIcon(level)}
                      <Badge variant={getRiskLevelColor(level) as "default" | "destructive" | "outline" | "secondary"}>
                        {level.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{data.tables} tables</div>
                      <div className="text-muted-foreground">
                        {data.incompatibleRecords.toLocaleString()} records
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results by Risk Level */}
      {['critical', 'high', 'medium', 'low'].map((riskLevel) => {
        const results = resultsByRisk[riskLevel];
        if (!results || results.length === 0) return null;

        return (
          <Card key={riskLevel}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {getRiskLevelIcon(riskLevel)}
                <CardTitle className="capitalize">{riskLevel} Risk Tables</CardTitle>
                <Badge variant={getRiskLevelColor(riskLevel) as "default" | "destructive" | "outline" | "secondary"}>
                  {results.length} tables
                </Badge>
              </div>
              <CardDescription>
                Tables with {riskLevel} risk of data loss during migration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table Name</TableHead>
                    <TableHead className="text-right">Total Records</TableHead>
                    <TableHead className="text-right">Incompatible</TableHead>
                    <TableHead className="text-right">Impact %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.tableName}>
                      <TableCell className="font-mono text-sm">
                        {result.tableName.replace('public.', '')}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totalRecords.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={result.incompatibleRecords > 0 ? 'text-destructive font-medium' : ''}>
                          {result.incompatibleRecords.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={result.percentageIncompatible > 0 ? 'text-destructive font-medium' : ''}>
                            {result.percentageIncompatible.toFixed(2)}%
                          </span>
                          <Progress 
                            value={result.percentageIncompatible} 
                            className="h-2 w-16"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.error ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : result.hasDetectionMethod ? (
                          result.incompatibleRecords > 0 ? (
                            <Badge variant="destructive">Incompatible</Badge>
                          ) : (
                            <Badge variant="secondary">Clean</Badge>
                          )
                        ) : (
                          <Badge variant="outline">No Detection</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {result.hasDetectionMethod && result.incompatibleRecords > 0 && sourceConnectionName ? (
                          <button
                            onClick={() => loadIncompatibleRecords(result.tableName)}
                            className="text-xs px-2 py-1 rounded border bg-muted hover:bg-accent transition"
                          >
                            View Records
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Tables without detection methods */}
      {summary.results.filter(r => !r.hasDetectionMethod).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tables Without Detection Methods</CardTitle>
            <CardDescription>
              These tables don&apos;t have automated incompatibility detection configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.results
                .filter(r => !r.hasDetectionMethod)
                .map((result) => (
                  <Badge key={result.tableName} variant="outline">
                    {result.tableName.replace('public.', '')}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incompatible Records Modal */}
      {openTable && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-background rounded-lg border shadow-lg w-full max-w-5xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="font-semibold text-lg">Incompatible Records: {openTable.replace('public.', '')}</h2>
                {recordsData && (
                  <p className="text-sm text-muted-foreground">
                    Showing {recordsData.returned} of {recordsData.totalIncompatible.toLocaleString()} incompatible rows
                  </p>
                )}
              </div>
              <button
                onClick={() => { setOpenTable(null); setRecordsData(null); setRecordsError(null); }}
                className="rounded px-2 py-1 text-sm hover:bg-muted"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {recordsLoading && (
                <div className="text-center py-10 text-sm text-muted-foreground">Loading incompatible records...</div>
              )}
              {recordsError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{recordsError}</AlertDescription>
                </Alert>
              )}
              {recordsData && recordsData.records.length === 0 && !recordsLoading && (
                <div className="text-center py-10 text-sm text-muted-foreground">No incompatible records found.</div>
              )}
              {recordsData && recordsData.records.length > 0 && (
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {recordsData.columns.map(col => (
                          <TableHead key={col} className="font-mono text-xs">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recordsData.records.map((row, idx) => (
                        <TableRow key={idx}>
                          {recordsData.columns.map(col => (
                            <TableCell key={col} className="font-mono text-xs whitespace-nowrap max-w-60 overflow-hidden text-ellipsis">
                              {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-between items-center gap-2">
              <div className="text-xs text-muted-foreground">
                {recordsData && recordsData.totalIncompatible > recordsData.returned && 'Display limited to first 50 rows.'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadIncompatibleRecords(openTable)}
                  disabled={recordsLoading}
                  className="text-xs px-3 py-1 rounded border bg-muted hover:bg-accent disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  onClick={() => { setOpenTable(null); setRecordsData(null); setRecordsError(null); }}
                  className="text-xs px-3 py-1 rounded border bg-destructive text-white hover:brightness-110"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
