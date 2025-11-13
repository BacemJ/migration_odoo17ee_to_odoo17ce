'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, Database, FileText } from 'lucide-react';

interface RecordCompatibilityResult {
  tableName: string;
  category: 'compatible_diff' | 'incompatible_diff';
  totalRecords: number;
  ceCompatibleRecords: number;
  eeOnlyRecords: number;
  percentageCompatible: number;
  missingColumns?: string[];
  sampleIncompatibleRecords?: Record<string, unknown>[];
}

interface DetailedAnalysisResult {
  compatibleDiffTables: RecordCompatibilityResult[];
  incompatibleDiffTables: RecordCompatibilityResult[];
  summary: {
    totalTablesAnalyzed: number;
    totalCompatibleTables: number;
    totalIncompatibleTables: number;
    totalRecords: number;
    ceCompatibleRecords: number;
    eeOnlyRecords: number;
  };
}

interface RecordAnalysisViewProps {
  analysis: DetailedAnalysisResult;
}

export default function RecordAnalysisView({ analysis }: RecordAnalysisViewProps) {
  const { summary, compatibleDiffTables, incompatibleDiffTables } = analysis;
  
  const overallCompatibilityPercentage = summary.totalRecords > 0
    ? (summary.ceCompatibleRecords / summary.totalRecords) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across {summary.totalTablesAnalyzed} tables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CE Compatible</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.ceCompatibleRecords.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {overallCompatibilityPercentage.toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EE Only</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary.eeOnlyRecords.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {(100 - overallCompatibilityPercentage).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tables Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTablesAnalyzed}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalCompatibleTables} compatible, {summary.totalIncompatibleTables} incompatible
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Compatibility</CardTitle>
          <CardDescription>
            Percentage of records that can be migrated to Odoo CE
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={overallCompatibilityPercentage} className="h-4" />
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-medium">
                {overallCompatibilityPercentage.toFixed(2)}% Compatible
              </span>
              <span className="text-orange-600 font-medium">
                {(100 - overallCompatibilityPercentage).toFixed(2)}% EE Only
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incompatible Diff Tables */}
      {incompatibleDiffTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Tables with Incompatible Differences ({incompatibleDiffTables.length})
            </CardTitle>
            <CardDescription>
              Tables with EE-only columns containing data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {incompatibleDiffTables.map((table, idx) => (
                <AccordionItem key={idx} value={`incompatible-${idx}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {table.tableName}
                        </code>
                        <Badge variant="destructive">
                          {table.percentageCompatible.toFixed(1)}% CE Compatible
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {table.totalRecords.toLocaleString()} records
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* Record Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Total Records</p>
                          <p className="text-lg font-semibold">{table.totalRecords.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">CE Compatible</p>
                          <p className="text-lg font-semibold text-green-600">
                            {table.ceCompatibleRecords.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">EE Only</p>
                          <p className="text-lg font-semibold text-orange-600">
                            {table.eeOnlyRecords.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <Progress value={table.percentageCompatible} className="h-2" />

                      {/* Missing Columns */}
                      {table.missingColumns && table.missingColumns.length > 0 && (
                        <Alert>
                          <AlertDescription>
                            <p className="font-medium mb-2">Missing columns in CE:</p>
                            <div className="flex flex-wrap gap-2">
                              {table.missingColumns.map((col, i) => (
                                <code key={i} className="text-xs bg-muted px-2 py-1 rounded">
                                  {col}
                                </code>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Sample Records */}
                      {table.sampleIncompatibleRecords && table.sampleIncompatibleRecords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Sample EE-only records:</p>
                          <div className="bg-muted p-3 rounded-md max-h-60 overflow-auto">
                            <pre className="text-xs">
                              {JSON.stringify(table.sampleIncompatibleRecords, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Compatible Diff Tables */}
      {compatibleDiffTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Tables with Compatible Differences ({compatibleDiffTables.length})
            </CardTitle>
            <CardDescription>
              Tables where all columns exist in CE but record counts differ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {compatibleDiffTables.map((table, idx) => (
                <AccordionItem key={idx} value={`compatible-${idx}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {table.tableName}
                        </code>
                        <Badge variant="default" className="bg-green-600">
                          {table.percentageCompatible.toFixed(1)}% CE Compatible
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {table.totalRecords.toLocaleString()} records
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* Record Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Source Records</p>
                          <p className="text-lg font-semibold">{table.totalRecords.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Already in CE</p>
                          <p className="text-lg font-semibold text-green-600">
                            {table.ceCompatibleRecords.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">To Migrate</p>
                          <p className="text-lg font-semibold text-blue-600">
                            {table.eeOnlyRecords.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <Progress value={table.percentageCompatible} className="h-2" />

                      <Alert>
                        <AlertDescription>
                          All required columns exist in CE. Records can be migrated successfully.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
