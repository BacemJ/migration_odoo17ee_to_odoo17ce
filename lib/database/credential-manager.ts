import {
  getConfigPool,
  testConnection,
  executeQuery,
  DatabaseConnection,
} from './connection';
import { PoolConfig } from 'pg';

/**
 * Create or update a database connection
 */
export async function saveConnection(data: {
  id?: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  role: 'source_ee' | 'staging' | 'target_ce';
}): Promise<DatabaseConnection> {
  const pool = getConfigPool();

  // If id provided, update by id (still allowed)
  if (data.id) {
    const result = await executeQuery<DatabaseConnection>(
      pool,
      `UPDATE database_connections 
       SET name = $1, host = $2, port = $3, database = $4, 
           username = $5, encrypted_password = $6, role = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        data.name,
        data.host,
        data.port,
        data.database,
        data.username,
        data.password,
        data.role,
        data.id,
      ]
    );
    return result[0];
  }

  // Upsert by unique name (name is constant per role/environment)
  const result = await executeQuery<DatabaseConnection>(
    pool,
    `INSERT INTO database_connections 
     (name, host, port, database, username, encrypted_password, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (name)
     DO UPDATE SET host = EXCLUDED.host,
                   port = EXCLUDED.port,
                   database = EXCLUDED.database,
                   username = EXCLUDED.username,
                   encrypted_password = EXCLUDED.encrypted_password,
                   role = EXCLUDED.role,
                   updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      data.name,
      data.host,
      data.port,
      data.database,
      data.username,
      data.password,
      data.role,
    ]
  );
  return result[0];
}

/**
 * Get all database connections
 */
export async function getAllConnections(): Promise<
  (Omit<DatabaseConnection, 'encrypted_password'> & { password: string })[]
> {
  const pool = getConfigPool();
  const result = await executeQuery<DatabaseConnection>(
    pool,
    `SELECT id, name, host, port, database, username, encrypted_password, role, created_at, updated_at 
     FROM database_connections 
     ORDER BY role, name`
  );
  
  // Return plain password (no encryption)
  return result.map(conn => ({
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: conn.encrypted_password,
    role: conn.role,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  }));
}

/**
 * Get a specific connection by ID
 */
export async function getConnection(
  id: number
): Promise<Omit<DatabaseConnection, 'encrypted_password'> | null> {
  const pool = getConfigPool();
  const result = await executeQuery<DatabaseConnection>(
    pool,
    `SELECT id, name, host, port, database, username, role, created_at, updated_at 
     FROM database_connections 
     WHERE id = $1`,
    [id]
  );
  return result[0] || null;
}

/**
 * Get connection by role
 */
export async function getConnectionByRole(
  role: 'source_ee' | 'staging' | 'target_ce'
): Promise<Omit<DatabaseConnection, 'encrypted_password'> | null> {
  const pool = getConfigPool();
  const result = await executeQuery<DatabaseConnection>(
    pool,
    `SELECT id, name, host, port, database, username, role, created_at, updated_at 
     FROM database_connections 
     WHERE role = $1`,
    [role]
  );
  return result[0] || null;
}

/**
 * Delete a database connection
 */
export async function deleteConnection(id: number): Promise<boolean> {
  const pool = getConfigPool();
  const result = await executeQuery(
    pool,
    'DELETE FROM database_connections WHERE id = $1 RETURNING id',
    [id]
  );
  return result.length > 0;
}

/**
 * Test a connection before saving
 */
export async function testConnectionBeforeSave(data: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<{
  success: boolean;
  message: string;
  serverVersion?: string;
}> {
  const config: PoolConfig = {
    host: data.host,
    port: data.port,
    database: data.database,
    user: data.username,
    password: data.password,
  };

  return testConnection(config);
}

/**
 * Get connection with decrypted password
 */
export async function getConnectionWithPassword(
  id: number
): Promise<DatabaseConnection | null> {
  const pool = getConfigPool();
  const result = await executeQuery<DatabaseConnection>(
    pool,
    'SELECT * FROM database_connections WHERE id = $1',
    [id]
  );

  if (result.length === 0) {
    return null;
  }

   return result[0];
}

/**
 * Verify all required connections exist
 */
export async function verifyRequiredConnections(): Promise<{
  valid: boolean;
  missing: string[];
}> {
  const pool = getConfigPool();
  const result = await executeQuery<{ role: string }>(
    pool,
    "SELECT role FROM database_connections WHERE role IN ('source_ee', 'staging', 'target_ce')"
  );

  const existingRoles = new Set(result.map((r) => r.role));
  const requiredRoles = ['source_ee', 'staging', 'target_ce'];
  const missing = requiredRoles.filter((role) => !existingRoles.has(role));

  return {
    valid: missing.length === 0,
    missing,
  };
}
