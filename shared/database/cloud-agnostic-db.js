// ============================================================================
// CLOUD-AGNOSTIC DATABASE ABSTRACTION LAYER
// ============================================================================
// Supports:
// - Local Development: SQLite (zero setup)
// - Cloud Deployment: PostgreSQL (GCP Cloud SQL, AWS RDS, Azure Database)
// - Environment-based switching via DATABASE_TYPE env var
// ============================================================================

const path = require('path');

class CloudAgnosticDatabase {
    constructor() {
        this.dbType = process.env.DATABASE_TYPE || 'sqlite'; // 'sqlite' | 'postgresql'
        this.connection = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            if (this.dbType === 'postgresql') {
                await this.initializePostgreSQL();
            } else {
                await this.initializeSQLite();
            }
            this.isInitialized = true;
            console.log(`✅ Database initialized: ${this.dbType.toUpperCase()}`);
        } catch (error) {
            console.error(`❌ Database initialization failed:`, error);
            throw error;
        }
    }

    async initializeSQLite() {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', '..', 'data', 'mangalm_sales.db');

        this.connection = new Database(dbPath);
        // TEMPORARILY DISABLE FK constraints for bulk import MVP
        this.connection.pragma('foreign_keys = OFF');
        this.connection.pragma('journal_mode = WAL');

        console.log('✅ SQLite connection established (local development) - FK constraints DISABLED for bulk import');
    }

    async initializePostgreSQL() {
        const { Pool } = require('pg');

        const connectionConfig = {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.connection = new Pool(connectionConfig);

        // Test connection
        const client = await this.connection.connect();
        await client.query('SELECT NOW()');
        client.release();

        console.log('✅ PostgreSQL connection established (cloud deployment)');
    }

    // Unified query interface
    async query(sql, params = []) {
        await this.initialize();

        if (this.dbType === 'postgresql') {
            const client = await this.connection.connect();
            try {
                const result = await client.query(sql, params);
                return {
                    rows: result.rows,
                    rowCount: result.rowCount
                };
            } finally {
                client.release();
            }
        } else {
            // SQLite
            try {
                if (sql.trim().toLowerCase().startsWith('select')) {
                    const stmt = this.connection.prepare(sql);
                    const rows = stmt.all(...params);
                    return {
                        rows: rows,
                        rowCount: rows.length
                    };
                } else {
                    const stmt = this.connection.prepare(sql);
                    const result = stmt.run(...params);
                    return {
                        rows: [],
                        rowCount: result.changes,
                        insertId: result.lastInsertRowid
                    };
                }
            } catch (error) {
                console.error('SQLite query error:', error);
                throw error;
            }
        }
    }

    // Disable foreign key constraints for bulk operations (MVP fix)
    async disableForeignKeys() {
        await this.initialize();

        if (this.dbType === 'postgresql') {
            // PostgreSQL: Temporarily disable FK triggers
            const client = await this.connection.connect();
            try {
                await client.query('SET session_replication_role = replica;');
                console.log('🔶 PostgreSQL FK constraints DISABLED for bulk import');
            } finally {
                client.release();
            }
        } else {
            // SQLite: FK already disabled in initialization
            console.log('🔶 SQLite FK constraints already DISABLED');
        }
    }

    // Re-enable foreign key constraints after bulk operations
    async enableForeignKeys() {
        await this.initialize();

        if (this.dbType === 'postgresql') {
            // PostgreSQL: Re-enable FK triggers
            const client = await this.connection.connect();
            try {
                await client.query('SET session_replication_role = DEFAULT;');
                console.log('✅ PostgreSQL FK constraints RE-ENABLED');
            } finally {
                client.release();
            }
        } else {
            // SQLite: Would need to be re-enabled if we want strict mode later
            console.log('✅ SQLite FK constraints remain DISABLED (MVP mode)');
        }
    }

    // Unified transaction interface
    async transaction(callback) {
        await this.initialize();

        if (this.dbType === 'postgresql') {
            const client = await this.connection.connect();
            try {
                await client.query('BEGIN');
                const result = await callback({
                    query: (sql, params) => client.query(sql, params)
                });
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else {
            // SQLite - handle synchronous transactions
            try {
                const result = await callback({
                    query: (sql, params) => {
                        const stmt = this.connection.prepare(sql);
                        return stmt.run(...params);
                    }
                });
                return result;
            } catch (error) {
                throw error;
            }
        }
    }

    // Database-specific SQL conversion
    convertSQL(sql) {
        if (this.dbType === 'postgresql') {
            // Convert SQLite syntax to PostgreSQL
            return sql
                .replace(/TEXT PRIMARY KEY/g, 'VARCHAR(255) PRIMARY KEY')
                .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT NOW()')
                .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
                .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE')
                .replace(/INTEGER/g, 'INT')
                .replace(/DECIMAL\((\d+),\s*(\d+)\)/g, 'NUMERIC($1,$2)')
                .replace(/INSERT OR IGNORE INTO/g, 'INSERT INTO')
                .replace(/INSERT INTO (\w+) \([^)]+\) VALUES \([^)]+\) ON CONFLICT DO NOTHING/g, (match) => {
                    // Add ON CONFLICT DO NOTHING for INSERT OR IGNORE equivalent
                    return match + ' ON CONFLICT DO NOTHING';
                });
        }
        return sql;
    }

    // Execute SQL with automatic conversion
    async executeSQL(sql, params = []) {
        const convertedSQL = this.convertSQL(sql);
        return await this.query(convertedSQL, params);
    }

    // Helper method for INSERT OR IGNORE functionality
    async insertOrIgnore(table, columns, values) {
        if (this.dbType === 'postgresql') {
            // PostgreSQL: Use ON CONFLICT DO NOTHING
            const columnNames = columns.join(', ');
            const placeholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
            const sql = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            return await this.query(sql, values);
        } else {
            // SQLite: Use INSERT OR IGNORE
            const columnNames = columns.join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT OR IGNORE INTO ${table} (${columnNames}) VALUES (${placeholders})`;
            return await this.query(sql, values);
        }
    }

    // Optimized batch insert for high-performance bulk operations
    async batchInsertOrIgnore(table, columns, valuesBatch) {
        if (!valuesBatch || valuesBatch.length === 0) return { rowCount: 0 };

        if (this.dbType === 'postgresql') {
            // PostgreSQL: Use single query with multiple VALUES
            const columnNames = columns.join(', ');
            const valuesClauses = valuesBatch.map((_, i) => {
                const start = i * columns.length;
                const placeholders = columns.map((_, j) => `$${start + j + 1}`).join(', ');
                return `(${placeholders})`;
            }).join(', ');

            const sql = `INSERT INTO ${table} (${columnNames}) VALUES ${valuesClauses} ON CONFLICT DO NOTHING`;
            const flatValues = valuesBatch.flat();
            return await this.query(sql, flatValues);
        } else {
            // SQLite: Use transaction with multiple INSERT OR IGNORE
            return await this.transaction(async (txn) => {
                const columnNames = columns.join(', ');
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT OR IGNORE INTO ${table} (${columnNames}) VALUES (${placeholders})`;

                const stmt = this.connection.prepare(sql);
                let insertCount = 0;

                for (const values of valuesBatch) {
                    try {
                        const result = stmt.run(...values);
                        if (result.changes > 0) insertCount++;
                    } catch (error) {
                        console.warn(`Batch insert warning for ${table}:`, error.message);
                    }
                }

                return { rowCount: insertCount };
            });
        }
    }

    // Health check
    async healthCheck() {
        try {
            await this.initialize();
            const result = await this.query('SELECT COUNT(*) as count FROM stores');
            return {
                status: 'healthy',
                type: this.dbType,
                stores_count: result.rows[0].count
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                type: this.dbType,
                error: error.message
            };
        }
    }

    // Get connection info for logging
    getConnectionInfo() {
        return {
            type: this.dbType,
            environment: process.env.NODE_ENV || 'development',
            cloud_ready: this.dbType === 'postgresql'
        };
    }

    async close() {
        if (this.connection) {
            if (this.dbType === 'postgresql') {
                await this.connection.end();
            } else {
                this.connection.close();
            }
            this.isInitialized = false;
        }
    }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
    if (!dbInstance) {
        dbInstance = new CloudAgnosticDatabase();
    }
    return dbInstance;
}

module.exports = {
    CloudAgnosticDatabase,
    getDatabase
};