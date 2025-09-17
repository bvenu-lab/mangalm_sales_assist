// SQLite Database Connection for API Gateway
import Database from 'better-sqlite3';
import path from 'path';

class SQLiteConnection {
    private static instance: SQLiteConnection;
    private db: Database.Database;

    private constructor() {
        const dbPath = path.join(__dirname, '..', '..', '..', '..', 'data', 'mangalm_sales.db');
        this.db = new Database(dbPath);
        this.db.pragma('foreign_keys = ON');
        console.log('✅ API Gateway connected to SQLite database');
    }

    public static getInstance(): SQLiteConnection {
        if (!SQLiteConnection.instance) {
            SQLiteConnection.instance = new SQLiteConnection();
        }
        return SQLiteConnection.instance;
    }

    public getDatabase(): Database.Database {
        return this.db;
    }

    public async testConnection(): Promise<void> {
        try {
            const result = this.db.prepare('SELECT COUNT(*) as count FROM stores').get() as { count: number };
            console.log(`✅ Database connection test successful. Found ${result.count} stores.`);
        } catch (error) {
            console.error('❌ Database connection test failed:', error);
            throw error;
        }
    }

    public close(): void {
        this.db.close();
    }
}

export default SQLiteConnection;