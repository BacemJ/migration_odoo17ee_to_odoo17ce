import { Pool, PoolClient, PoolConfig } from 'pg';
import crypto from 'crypto';

// Configuration database pool (stores credentials and job tracking)
let configPool: Pool | null = null;

// Odoo database pools (source, staging, target)
const odooPools = new Map<string, Pool>();

/**
 * Get or create the configuration database pool
 */
export function getConfigPool(): Pool {
  if (!configPool) {
    const config: PoolConfig = {
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '5432'),
      database: process.env.CONFIG_DB_NAME || 'odoo_migration_config',
      user: process.env.CONFIG_DB_USER || 'postgres',
      password: process.env.CONFIG_DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    configPool = new Pool(config);

    // Handle pool errors
    configPool.on('error', (err) => {
      console.error('Unexpected error on config database pool', err);
    });
  }

  return configPool;
}

/**
 * Get or create an Odoo database pool
 */
export function getOdooPool(connectionId: string, config: PoolConfig): Pool {
  if (!odooPools.has(connectionId)) {
    const pool = new Pool({
      ...config,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error(`Unexpected error on Odoo database pool ${connectionId}`, err);
    });

    odooPools.set(connectionId, pool);
  }

  return odooPools.get(connectionId)!;
}

/**
 * Close a specific Odoo database pool
 */
export async function closeOdooPool(connectionId: string): Promise<void> {
  const pool = odooPools.get(connectionId);
  if (pool) {
    await pool.end();
    odooPools.delete(connectionId);
  }
}

/**
 * Close all database pools
 */
export async function closeAllPools(): Promise<void> {
  // Close config pool
  if (configPool) {
    await configPool.end();
    configPool = null;
  }

  // Close all Odoo pools
  for (const [id, pool] of odooPools.entries()) {
    await pool.end();
    odooPools.delete(id);
  }
}

/**
 * Test a database connection
 */
export async function testConnection(config: PoolConfig): Promise<{
  success: boolean;
  message: string;
  serverVersion?: string;
}> {
  const testPool = new Pool({
    ...config,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;
    client.release();
    await testPool.end();

    return {
      success: true,
      message: 'Connection successful',
      serverVersion: version,
    };
  } catch (error) {
    await testPool.end();
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a query with automatic connection handling
 */
export async function executeQuery<T = unknown>(
  pool: Pool,
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function executeTransaction(
  pool: Pool,
  queries: Array<{ query: string; params?: unknown[] }>
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { query, params } of queries) {
      await client.query(query, params);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client for manual transaction handling
 */
export async function getClient(pool: Pool): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Encryption helper for passwords
 */
export function encryptPassword(password: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }

  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decryption helper for passwords
 */
export function decryptPassword(encryptedPassword: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }

  const keyBuffer = Buffer.from(key, 'hex');
  const [ivHex, encryptedHex] = encryptedPassword.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encrypted_password: string;
  role: 'source_ee' | 'staging' | 'target_ce';
  created_at: Date;
  updated_at: Date;
}

/**
 * Get database connection configuration (decrypted)
 */
export async function getConnectionConfig(
  connectionId: number
): Promise<PoolConfig> {
  const pool = getConfigPool();
  const result = await executeQuery<DatabaseConnection>(
    pool,
    'SELECT * FROM database_connections WHERE id = $1',
    [connectionId]
  );

  if (result.length === 0) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  const conn = result[0];
  const password = decryptPassword(conn.encrypted_password);

  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.username,
    password: password,
  };
}
