"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  Database, 
  FileWarning, 
  Settings, 
  Code,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";

export interface ColumnDataLoss {
  columnName: string;
  dataType: string;
  recordsWithData: number;
  isBusinessCritical: boolean;
  sampleValues: unknown[];
}

export interface TableDataType {
  category: 'business_data' | 'system_configuration' | 'application_configuration' | 'technical';
  description: string;
}

export interface SampleRecord extends Record<string, unknown> {
  _missingInCE?: string[];
}

export interface FieldDataLossAnalysis {
  tableName: string;
  dataType: TableDataType;
  missingColumns: ColumnDataLoss[];
  totalRecordsInTable: number;
  recordsWithDataLoss: number;
  sampleRecords: SampleRecord[];
}

export interface IncompatibleFieldsSummary {
  totalTablesAnalyzed: number;
  businessDataTables: number;
  configurationTables: number;
  technicalTables: number;
  totalRecordsWithDataLoss: number;
  businessCriticalFieldsAffected: number;
}

interface IncompatibleFieldsViewProps {
  analysis: FieldDataLossAnalysis[];
  summary: IncompatibleFieldsSummary;
}

export default function IncompatibleFieldsView({ analysis, summary }: IncompatibleFieldsViewProps) {
  const [showSampleData, setShowSampleData] = useState<Record<string, boolean>>({});

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'business_data':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'application_configuration':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'system_configuration':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'technical':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const toggleSampleData = (tableName: string) => {
    setShowSampleData(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  // Group analysis by category
  const businessData = analysis.filter(a => a.dataType.category === 'business_data');
  const configData = analysis.filter(a => 
    a.dataType.category === 'application_configuration' || 
    a.dataType.category === 'system_configuration'
  );
  const technicalData = analysis.filter(a => a.dataType.category === 'technical');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Step 2: Data Loss Analysis - Incompatible Fields
        </CardTitle>
        <CardDescription>
          Analysis of data that will be lost due to fields missing in Odoo CE
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2 p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground">Tables Analyzed</div>
            <div className="text-2xl font-bold">{summary.totalTablesAnalyzed}</div>
          </div>

          <div className="space-y-2 p-4 rounded-lg border bg-red-50">
            <div className="text-sm text-red-700 font-medium">Business Data</div>
            <div className="text-2xl font-bold text-red-700">{summary.businessDataTables}</div>
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
              Critical
            </Badge>
          </div>

          <div className="space-y-2 p-4 rounded-lg border bg-orange-50">
            <div className="text-sm text-orange-700 font-medium">Configuration</div>
            <div className="text-2xl font-bold text-orange-700">{summary.configurationTables}</div>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
              Important
            </Badge>
          </div>

          <div className="space-y-2 p-4 rounded-lg border bg-blue-50">
            <div className="text-sm text-blue-700 font-medium">Technical</div>
            <div className="text-2xl font-bold text-blue-700">{summary.technicalTables}</div>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
              Low Impact
            </Badge>
          </div>

          <div className="space-y-2 p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground">Records Affected</div>
            <div className="text-2xl font-bold">{summary.totalRecordsWithDataLoss.toLocaleString()}</div>
          </div>

          <div className="space-y-2 p-4 rounded-lg border bg-amber-50">
            <div className="text-sm text-amber-700 font-medium">Business Fields</div>
            <div className="text-2xl font-bold text-amber-700">{summary.businessCriticalFieldsAffected}</div>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
              Lost Fields
            </Badge>
          </div>
        </div>

        {/* Alert for business data */}
        {summary.businessDataTables > 0 && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Critical Warning:</strong> {summary.businessDataTables} table(s) containing business data will lose information 
              during migration. {summary.businessCriticalFieldsAffected} business-critical fields will be lost, 
              affecting {summary.totalRecordsWithDataLoss.toLocaleString()} record(s).
            </AlertDescription>
          </Alert>
        )}

        {/* Business Data Tables */}
        {businessData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-700">Business Data Tables (Critical)</h3>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {businessData.length} tables
              </Badge>
            </div>
            
            <Accordion type="multiple" className="space-y-2">
              {businessData.map((table) => (
                <AccordionItem 
                  key={table.tableName} 
                  value={table.tableName}
                  className="border rounded-lg bg-white"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">{table.tableName}</span>
                        <Badge variant="outline" className={getCategoryColor(table.dataType.category)}>
                          {table.dataType.description}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {table.recordsWithDataLoss.toLocaleString()} / {table.totalRecordsInTable.toLocaleString()} records affected
                        </span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          {table.missingColumns.length} fields lost
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <div className="space-y-4">
                      {/* Missing Columns Details */}
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <FileWarning className="h-4 w-4" />
                          Fields Missing in Odoo CE
                        </h4>
                        <div className="space-y-2">
                          {table.missingColumns.map((col) => (
                            <div 
                              key={col.columnName}
                              className={`p-3 rounded-lg border ${
                                col.isBusinessCritical 
                                  ? 'bg-red-50 border-red-200' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold">{col.columnName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {col.dataType}
                                  </Badge>
                                  {col.isBusinessCritical && (
                                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                                      Business Critical
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {col.recordsWithData.toLocaleString()} records with data
                                </span>
                              </div>
                              
                              {col.sampleValues.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs text-muted-foreground mb-1">Sample values:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {col.sampleValues.map((val, idx) => (
                                      <code 
                                        key={idx}
                                        className="text-xs bg-white px-2 py-1 rounded border"
                                      >
                                        {formatValue(val)}
                                      </code>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sample Records */}
                      {table.sampleRecords.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Sample Records ({table.sampleRecords.length})
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSampleData(table.tableName)}
                            >
                              {showSampleData[table.tableName] ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Hide Data
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show Data
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {showSampleData[table.tableName] && (
                            <div className="overflow-x-auto border rounded-lg">
                              <Alert className="mb-3 bg-red-50 border-red-200">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-sm text-red-800">
                                  <strong>Red highlighted columns</strong> will be lost during migration (missing in CE)
                                </AlertDescription>
                              </Alert>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    {(() => {
                                      // Get all columns including missing ones
                                      const allColumns = Object.keys(table.sampleRecords[0] || {})
                                        .filter(key => key !== '_missingInCE');
                                      const missingCols = table.sampleRecords[0]._missingInCE || [];
                                      
                                      // Show missing columns first, then regular columns
                                      const sortedColumns = [
                                        ...allColumns.filter(col => missingCols.includes(col)),
                                        ...allColumns.filter(col => !missingCols.includes(col))
                                      ];
                                      
                                      return sortedColumns.map(key => (
                                        <th 
                                          key={key}
                                          className={`px-3 py-2 text-left font-semibold border-r ${
                                            missingCols.includes(key)
                                              ? 'bg-red-100 text-red-700 border-red-300'
                                              : 'bg-gray-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1">
                                            {missingCols.includes(key) && (
                                              <AlertTriangle className="h-3 w-3 shrink-0" />
                                            )}
                                            <span className="font-mono text-xs">{key}</span>
                                          </div>
                                        </th>
                                      ));
                                    })()}
                                  </tr>
                                </thead>
                                <tbody>
                                  {table.sampleRecords.map((record, idx) => {
                                    const allColumns = Object.keys(record).filter(key => key !== '_missingInCE');
                                    const missingCols = record._missingInCE || [];
                                    const sortedColumns = [
                                      ...allColumns.filter(col => missingCols.includes(col)),
                                      ...allColumns.filter(col => !missingCols.includes(col))
                                    ];
                                    
                                    return (
                                      <tr key={idx} className="border-t hover:bg-gray-50">
                                        {sortedColumns.map((key) => (
                                          <td 
                                            key={key}
                                            className={`px-3 py-2 border-r ${
                                              missingCols.includes(key)
                                                ? 'bg-red-50 font-semibold border-red-200'
                                                : ''
                                            }`}
                                          >
                                            <code className="text-xs">
                                              {formatValue(record[key])}
                                            </code>
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* Configuration Tables */}
        {configData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-orange-700">Configuration Tables</h3>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {configData.length} tables
              </Badge>
            </div>
            
            <Accordion type="multiple" className="space-y-2">
              {configData.map((table) => (
                <AccordionItem 
                  key={table.tableName} 
                  value={table.tableName}
                  className="border rounded-lg bg-white"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">{table.tableName}</span>
                        <Badge variant="outline" className={getCategoryColor(table.dataType.category)}>
                          {table.dataType.description}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {table.recordsWithDataLoss.toLocaleString()} / {table.totalRecordsInTable.toLocaleString()} records
                        </span>
                        <Badge variant="outline">
                          {table.missingColumns.length} fields
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4 pt-2">
                    {/* Similar content structure as business data */}
                    <div className="text-sm text-muted-foreground">
                      Configuration data - {table.missingColumns.length} field(s) will be lost
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* Technical Tables */}
        {technicalData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-700">Technical Tables (Low Impact)</h3>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {technicalData.length} tables
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground">
              These tables contain technical or temporary data. Data loss is typically non-critical.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
