import { Pool } from 'pg';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import {
  getConfigPool,
  getOdooPool,
  getConnectionConfig,
  executeQuery,
} from '../database/connection';

const BATCH_SIZE = 1000;
const COMPRESSION_THRESHOLD_MB = 1;

export interface ExportCheckpoint {
  id: number;
  job_id: number;
  module_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  records_exported: number;
  total_records: number;
  file_path: string | null;
  file_size_bytes: number;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
}

export interface ExportModuleConfig {
  moduleName: string;
  tables: Array<{
    tableName: string;
    orderBy?: string;
  }>;
}

// Define EE modules to export
const EXPORT_MODULES: ExportModuleConfig[] = [
  {
    moduleName: 'helpdesk',
    tables: [
      { tableName: 'helpdesk_team', orderBy: 'id' },
      { tableName: 'helpdesk_stage', orderBy: 'sequence, id' },
      { tableName: 'helpdesk_sla', orderBy: 'id' },
      { tableName: 'helpdesk_tag', orderBy: 'id' },
      { tableName: 'helpdesk_ticket', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'subscriptions',
    tables: [
      { tableName: 'sale_subscription_template', orderBy: 'id' },
      { tableName: 'sale_subscription_stage', orderBy: 'sequence, id' },
      { tableName: 'sale_subscription', orderBy: 'id' },
      { tableName: 'sale_subscription_line', orderBy: 'id' },
      { tableName: 'sale_subscription_alert', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'documents',
    tables: [
      { tableName: 'documents_folder', orderBy: 'id' },
      { tableName: 'documents_facet', orderBy: 'id' },
      { tableName: 'documents_tag', orderBy: 'id' },
      { tableName: 'documents_document', orderBy: 'id' },
      { tableName: 'documents_workflow_rule', orderBy: 'id' },
      { tableName: 'documents_share', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'planning',
    tables: [
      { tableName: 'planning_role', orderBy: 'id' },
      { tableName: 'planning_template', orderBy: 'id' },
      { tableName: 'planning_slot', orderBy: 'id' },
      { tableName: 'planning_recurrency', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'sign',
    tables: [
      { tableName: 'sign_template', orderBy: 'id' },
      { tableName: 'sign_item', orderBy: 'id' },
      { tableName: 'sign_request', orderBy: 'id' },
      { tableName: 'sign_request_item', orderBy: 'id' },
      { tableName: 'sign_request_item_value', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'approvals',
    tables: [
      { tableName: 'approval_category', orderBy: 'id' },
      { tableName: 'approval_request', orderBy: 'id' },
      { tableName: 'approval_approver', orderBy: 'id' },
      { tableName: 'approval_product_line', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'iot',
    tables: [
      { tableName: 'iot_box', orderBy: 'id' },
      { tableName: 'iot_device', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'voip',
    tables: [
      { tableName: 'voip_configurator', orderBy: 'id' },
      { tableName: 'voip_phonecall', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'payroll',
    tables: [
      { tableName: 'hr_payroll_structure_type', orderBy: 'id' },
      { tableName: 'hr_payroll_structure', orderBy: 'id' },
      { tableName: 'hr_payslip_run', orderBy: 'id' },
      { tableName: 'hr_payslip', orderBy: 'id' },
      { tableName: 'hr_payslip_line', orderBy: 'id' },
    ],
  },
  {
    moduleName: 'fleet',
    tables: [
      { tableName: 'fleet_vehicle_model', orderBy: 'id' },
      { tableName: 'fleet_vehicle', orderBy: 'id' },
      { tableName: 'fleet_vehicle_log_contract', orderBy: 'id' },
      { tableName: 'fleet_vehicle_log_services', orderBy: 'id' },
    ],
  },
];

/**
 * Initialize export checkpoints for a job
 */
export async function initializeExportCheckpoints(jobId: number): Promise<void> {
  const configPool = getConfigPool();

  for (const module of EXPORT_MODULES) {
    await executeQuery(
      configPool,
      `INSERT INTO export_checkpoints (job_id, module_name, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (job_id, module_name) DO NOTHING`,
      [jobId, module.moduleName]
    );
  }
}

/**
 * Get export checkpoints for a job
 */
export async function getExportCheckpoints(
  jobId: number
): Promise<ExportCheckpoint[]> {
  const configPool = getConfigPool();
  return executeQuery<ExportCheckpoint>(
    configPool,
    'SELECT * FROM export_checkpoints WHERE job_id = $1 ORDER BY id',
    [jobId]
  );
}

/**
 * Update export checkpoint
 */
export async function updateExportCheckpoint(
  checkpointId: number,
  updates: Partial<ExportCheckpoint>
): Promise<void> {
  const configPool = getConfigPool();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'job_id' && key !== 'module_name') {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length > 0) {
    values.push(checkpointId);
    await executeQuery(
      configPool,
      `UPDATE export_checkpoints SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }
}

/**
 * Check if a table exists
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await executeQuery<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result[0].exists;
}

/**
 * Get total record count for a table
 */
async function getTableCount(pool: Pool, tableName: string): Promise<number> {
  const result = await executeQuery<{ count: string }>(
    pool,
    `SELECT COUNT(*) as count FROM ${tableName}`
  );
  return parseInt(result[0].count);
}

/**
 * Export a single module
 */
export async function exportModule(
  jobId: number,
  sourceConnectionId: number,
  moduleConfig: ExportModuleConfig,
  exportDir: string
): Promise<void> {
  const configPool = getConfigPool();
  
  // Get checkpoint
  const checkpoints = await executeQuery<ExportCheckpoint>(
    configPool,
    'SELECT * FROM export_checkpoints WHERE job_id = $1 AND module_name = $2',
    [jobId, moduleConfig.moduleName]
  );

  if (checkpoints.length === 0) {
    throw new Error(`No checkpoint found for module ${moduleConfig.moduleName}`);
  }

  const checkpoint = checkpoints[0];

  // Skip if already completed
  if (checkpoint.status === 'completed') {
    return;
  }

  // Mark as in progress
  await updateExportCheckpoint(checkpoint.id, {
    status: 'in_progress',
    started_at: new Date(),
  });

  try {
    // Get source database connection
    const sourceConfig = await getConnectionConfig(sourceConnectionId);
    const sourcePool = getOdooPool(`source_${sourceConnectionId}`, sourceConfig);

    // Prepare export data
    const exportData: Record<string, any[]> = {};
    let totalRecords = 0;

    // Export each table
    for (const tableConfig of moduleConfig.tables) {
      const exists = await tableExists(sourcePool, tableConfig.tableName);
      if (!exists) {
        console.log(`Table ${tableConfig.tableName} does not exist, skipping`);
        exportData[tableConfig.tableName] = [];
        continue;
      }

      const count = await getTableCount(sourcePool, tableConfig.tableName);
      totalRecords += count;

      const records: any[] = [];
      let offset = 0;

      while (offset < count) {
        const orderBy = tableConfig.orderBy || 'id';
        const batch = await executeQuery(
          sourcePool,
          `SELECT * FROM ${tableConfig.tableName} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
          [BATCH_SIZE, offset]
        );

        records.push(...batch);
        offset += BATCH_SIZE;

        // Update progress
        await updateExportCheckpoint(checkpoint.id, {
          records_exported: offset,
          total_records: totalRecords,
        });
      }

      exportData[tableConfig.tableName] = records;
    }

    // Ensure export directory exists
    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true });
    }

    // Generate file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${moduleConfig.moduleName}_${timestamp}.json`;
    const filePath = path.join(exportDir, fileName);

    // Convert to JSON
    const jsonData = JSON.stringify(
      {
        module: moduleConfig.moduleName,
        exported_at: new Date().toISOString(),
        total_records: totalRecords,
        tables: exportData,
      },
      null,
      2
    );

    const jsonSize = Buffer.byteLength(jsonData, 'utf8');
    const shouldCompress = jsonSize > COMPRESSION_THRESHOLD_MB * 1024 * 1024;

    let finalPath = filePath;
    let finalSize = jsonSize;

    if (shouldCompress) {
      // Write compressed file
      finalPath = filePath + '.gz';
      const readStream = require('stream').Readable.from([jsonData]);
      const gzipStream = createGzip();
      const writeStream = createWriteStream(finalPath);

      await pipeline(readStream, gzipStream, writeStream);

      // Get compressed file size
      const fs = require('fs');
      const stats = fs.statSync(finalPath);
      finalSize = stats.size;
    } else {
      // Write uncompressed file
      const fs = require('fs');
      fs.writeFileSync(finalPath, jsonData, 'utf8');
    }

    // Mark as completed
    await updateExportCheckpoint(checkpoint.id, {
      status: 'completed',
      completed_at: new Date(),
      file_path: finalPath,
      file_size_bytes: finalSize,
      total_records: totalRecords,
      records_exported: totalRecords,
    });
  } catch (error) {
    // Mark as failed
    await updateExportCheckpoint(checkpoint.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Export all modules (resumable)
 */
export async function exportAllModules(
  jobId: number,
  sourceConnectionId: number,
  exportDir?: string
): Promise<void> {
  const baseExportDir = exportDir || process.env.EXPORT_DIR || './exports';
  const jobExportDir = path.join(baseExportDir, `job_${jobId}`);

  // Initialize checkpoints if not exists
  await initializeExportCheckpoints(jobId);

  // Get checkpoints
  const checkpoints = await getExportCheckpoints(jobId);

  // Export each module that isn't completed
  for (const checkpoint of checkpoints) {
    if (checkpoint.status !== 'completed') {
      const moduleConfig = EXPORT_MODULES.find(
        (m) => m.moduleName === checkpoint.module_name
      );

      if (moduleConfig) {
        await exportModule(
          jobId,
          sourceConnectionId,
          moduleConfig,
          jobExportDir
        );
      }
    }
  }
}

/**
 * Get export progress
 */
export async function getExportProgress(jobId: number): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  pending: number;
  percentage: number;
  checkpoints: ExportCheckpoint[];
}> {
  const checkpoints = await getExportCheckpoints(jobId);

  const stats = {
    total: checkpoints.length,
    completed: checkpoints.filter((c) => c.status === 'completed').length,
    inProgress: checkpoints.filter((c) => c.status === 'in_progress').length,
    failed: checkpoints.filter((c) => c.status === 'failed').length,
    pending: checkpoints.filter((c) => c.status === 'pending').length,
    percentage: 0,
    checkpoints,
  };

  stats.percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return stats;
}
