"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface TableComparisonDetail {
  tableName: string;
  category: 'missing_in_target' | 'identical_records' | 'compatible_diff' | 'incompatible_diff';
  sourceRecordCount: number;
  targetRecordCount?: number;
  missingColumns?: string[];
  nullOnlyColumns?: string[];
}

interface TableComparisonResult {
  tablesWithData: number;
  tablesMissingInTarget: number;
  tablesWithIdenticalRecords: number;
  tablesWithCompatibleDiff: number;
  tablesWithIncompatibleDiff: number;
  tableDetails: TableComparisonDetail[];
}

interface TableComparisonViewProps {
  comparison: TableComparisonResult;
  sourceId?: number;
  targetId?: number;
  showOnlyIncompatible?: boolean;
}

export default function TableComparisonView({ comparison, showOnlyIncompatible = false }: TableComparisonViewProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'identical_records':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'compatible_diff':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'incompatible_diff':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'missing_in_target':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTablesByCategory = (category: string) => {
    return comparison.tableDetails.filter(t => t.category === category);
  };

  return (
    <Card>
      {!showOnlyIncompatible && (
        <CardHeader>
          <CardTitle>Database Comparison Results</CardTitle>
          <CardDescription>
            Side-by-side comparison of source (Odoo EE) and target (Odoo CE) databases
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Tables with Data</div>
            <div className="text-2xl font-bold">{comparison.tablesWithData}</div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Total
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Missing in Target</div>
            <div className="text-2xl font-bold">{comparison.tablesMissingInTarget}</div>
            <Badge variant="outline" className={getCategoryColor('missing_in_target')}>
              Missing
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Identical Records</div>
            <div className="text-2xl font-bold">{comparison.tablesWithIdenticalRecords}</div>
            <Badge variant="outline" className={getCategoryColor('identical_records')}>
              ✓ Identical
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Compatible Diff</div>
            <div className="text-2xl font-bold">{comparison.tablesWithCompatibleDiff}</div>
            <Badge variant="outline" className={getCategoryColor('compatible_diff')}>
              ⚠ Compatible
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Incompatible Diff</div>
            <div className="text-2xl font-bold">{comparison.tablesWithIncompatibleDiff}</div>
            <Badge variant="outline" className={getCategoryColor('incompatible_diff')}>
              ✗ Incompatible
            </Badge>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <Accordion type="multiple" className="w-full">
          {/* Missing Tables */}
          {comparison.tablesMissingInTarget > 0 && (
            <AccordionItem value="missing">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getCategoryColor('missing_in_target')}>
                    {comparison.tablesMissingInTarget}
                  </Badge>
                  <span>Tables Missing in Target</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {getTablesByCategory('missing_in_target').map((table) => (
                    <div key={table.tableName} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div>
                        <div className="font-mono text-sm font-semibold">{table.tableName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Source: {table.sourceRecordCount.toLocaleString()} records
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-700">
                        Not Found
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Identical Tables */}
          {comparison.tablesWithIdenticalRecords > 0 && (
            <AccordionItem value="identical">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getCategoryColor('identical_records')}>
                    {comparison.tablesWithIdenticalRecords}
                  </Badge>
                  <span>Tables with Identical Records</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {getTablesByCategory('identical_records').map((table) => (
                    <div key={table.tableName} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <div className="font-mono text-sm font-semibold">{table.tableName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Both: {table.sourceRecordCount.toLocaleString()} records
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-700">
                        ✓ Match
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Compatible Differences */}
          {comparison.tablesWithCompatibleDiff > 0 && (
            <AccordionItem value="compatible">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getCategoryColor('compatible_diff')}>
                    {comparison.tablesWithCompatibleDiff}
                  </Badge>
                  <span>Tables with Compatible Differences</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {getTablesByCategory('compatible_diff').map((table) => (
                    <div key={table.tableName} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm font-semibold">{table.tableName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Source: {table.sourceRecordCount.toLocaleString()} records • 
                            Target: {table.targetRecordCount?.toLocaleString()} records
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                          Compatible
                        </Badge>
                      </div>
                      {table.nullOnlyColumns && table.nullOnlyColumns.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="font-semibold">Null-only columns (ignored):</span> {table.nullOnlyColumns.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Incompatible Differences */}
          {comparison.tablesWithIncompatibleDiff > 0 && (
            <AccordionItem value="incompatible">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getCategoryColor('incompatible_diff')}>
                    {comparison.tablesWithIncompatibleDiff}
                  </Badge>
                  <span>Tables with Incompatible Differences</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {getTablesByCategory('incompatible_diff').map((table) => (
                    <div key={table.tableName} className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-mono text-sm font-semibold">{table.tableName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Source: {table.sourceRecordCount.toLocaleString()} records • 
                            Target: {table.targetRecordCount?.toLocaleString()} records
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-red-100 text-red-700">
                          ✗ Incompatible
                        </Badge>
                      </div>
                      {table.missingColumns && table.missingColumns.length > 0 && (
                        <div className="text-xs bg-red-100 text-red-900 p-2 rounded mt-2">
                          <span className="font-semibold">⚠ Missing columns in target:</span> {table.missingColumns.join(', ')}
                        </div>
                      )}
                      {table.nullOnlyColumns && table.nullOnlyColumns.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="font-semibold">Null-only columns (ignored):</span> {table.nullOnlyColumns.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
