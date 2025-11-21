import React from 'react';
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

export function EEAnalysisView({ summary, loading }: EEAnalysisViewProps) {
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
    </div>
  );
}
