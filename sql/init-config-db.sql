-- Configuration Database Schema for Odoo Migration Tool
-- This database stores encrypted connection credentials and migration job tracking

-- Database Connections Table
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    database VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('source_ee', 'staging', 'target_ce')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration Jobs Table
CREATE TABLE IF NOT EXISTS migration_jobs (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'exporting', 'migrating', 'validating', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    config_json JSONB,
    error_message TEXT NULL,
    dry_run BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Export Checkpoints Table
CREATE TABLE IF NOT EXISTS export_checkpoints (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES migration_jobs(id) ON DELETE CASCADE,
    module_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    records_exported INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    file_path TEXT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, module_name)
);

-- Migration Steps Log Table
CREATE TABLE IF NOT EXISTS migration_steps_log (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES migration_jobs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    sql_executed TEXT NULL,
    rows_affected INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    error_message TEXT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analysis Results Table
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES migration_jobs(id) ON DELETE CASCADE,
    ee_modules_found JSONB,
    ee_tables_found JSONB,
    foreign_key_dependencies JSONB,
    record_counts JSONB,
    estimated_export_size_mb NUMERIC(10, 2),
    risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    warnings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Validation Results Table
CREATE TABLE IF NOT EXISTS validation_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES migration_jobs(id) ON DELETE CASCADE,
    check_name VARCHAR(255) NOT NULL,
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
    details TEXT NULL,
    records_found INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX idx_export_checkpoints_job_id ON export_checkpoints(job_id);
CREATE INDEX idx_export_checkpoints_status ON export_checkpoints(status);
CREATE INDEX idx_migration_steps_log_job_id ON migration_steps_log(job_id);
CREATE INDEX idx_analysis_results_job_id ON analysis_results(job_id);
CREATE INDEX idx_validation_results_job_id ON validation_results(job_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for database_connections
CREATE TRIGGER update_database_connections_updated_at
    BEFORE UPDATE ON database_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample comment
COMMENT ON TABLE database_connections IS 'Stores encrypted connection credentials for source EE, staging, and target CE databases';
COMMENT ON TABLE migration_jobs IS 'Tracks migration job execution and status';
COMMENT ON TABLE export_checkpoints IS 'Enables resumable exports by tracking progress per module';
COMMENT ON TABLE migration_steps_log IS 'Detailed log of each migration step execution';
COMMENT ON TABLE analysis_results IS 'Stores pre-migration analysis results';
COMMENT ON TABLE validation_results IS 'Stores post-migration validation check results';
