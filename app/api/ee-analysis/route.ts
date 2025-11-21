import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getConnectionWithPassword } from '@/lib/database/credential-manager';
import { getConnectionConfigByName } from '@/lib/database/connection';
import { getIncompatibilitySummary, getScanTables } from '@/lib/odoo/analyze_ee';

export async function POST(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const { connectionId, connectionName } = await request.json();

    if (!connectionId && !connectionName) {
      return NextResponse.json(
        { error: 'Either connectionName or connectionId is required' },
        { status: 400 }
      );
    }

    let poolConfig: { host: string; port: number; database: string; user: string; password: string } | null = null;

    if (connectionName) {
      try {
        const cfg = await getConnectionConfigByName(connectionName);
        const resolvedPassword = typeof cfg.password === 'function' ? '' : (cfg.password || '');
        poolConfig = {
          host: cfg.host || 'localhost',
          port: cfg.port || 5432,
          database: cfg.database || '',
          user: cfg.user || '',
          password: resolvedPassword,
        };
      } catch {
        return NextResponse.json(
          { error: `Connection with name '${connectionName}' not found` },
          { status: 404 }
        );
      }
    } else if (connectionId) {
      const connection = await getConnectionWithPassword(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }
      poolConfig = {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.encrypted_password,
      };
    }

    pool = new Pool(poolConfig!);

    // Test connection
    await pool.query('SELECT 1');

    // Execute analysis
    const summary = await getIncompatibilitySummary(pool);
    
    // Enrich results with risk level information
    const scanTables = getScanTables();
    const enrichedResults = summary.results.map(result => ({
      ...result,
      riskLevel: scanTables[result.tableName]?.risk_level || 'low',
      tableRole: scanTables[result.tableName]?.table_role || 'unknown',
      migrationAction: scanTables[result.tableName]?.migration_action || 'unknown',
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        results: enrichedResults,
      },
    });

  } catch (error) {
    console.error('Error executing EE analysis:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
