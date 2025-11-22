import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getConnectionConfigByName } from '@/lib/database/connection';
import { getIncompatibleRecords } from '@/lib/odoo/analyze_ee';

export async function POST(request: NextRequest) {
  let pool: Pool | null = null;
  try {
    const { connectionName, tableName, limit } = await request.json();

    if (!connectionName || !tableName) {
      return NextResponse.json(
        { success: false, error: 'connectionName and tableName are required' },
        { status: 400 }
      );
    }

    const cfg = await getConnectionConfigByName(connectionName);
    pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: typeof cfg.password === 'function' ? '' : cfg.password || '',
    });

    // Test connection
    await pool.query('SELECT 1');

    const { records, columns, totalIncompatible } = await getIncompatibleRecords(
      pool,
      tableName,
      typeof limit === 'number' ? limit : 50
    );

    return NextResponse.json({
      success: true,
      data: {
        tableName,
        totalIncompatible,
        returned: records.length,
        columns,
        records,
      },
    });
  } catch (error) {
    console.error('Error fetching incompatible records:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch incompatible records',
      },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}