import { Pool, PoolClient } from "pg";
import chalk from "chalk";
import { EnvConfig, loadEnvConfig } from "../../config/config";

export interface DatabaseConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig | null = null;

  async initialize(config?: DatabaseConfig): Promise<void> {
    this.config = config || (loadEnvConfig() as DatabaseConfig);

    this.pool = new Pool({
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_USER,
      password: this.config.DB_PASSWORD,
      ssl: this.config.DB_SSL ? { rejectUnauthorized: false } : false,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      console.log(
        chalk.green("✅ Database connection established successfully")
      );
    } catch (error) {
      console.error(chalk.red("❌ Failed to connect to database:"), error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return await this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log(chalk.blue("🔌 Database connection closed"));
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  getConfig() {
    return this.config;
  }
}

// Singleton instance
export const dbManager = new DatabaseManager();

// Helper functions for common database operations
export async function getTableSchema(tableName: string): Promise<any[]> {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;

  const result = await dbManager.query(query, [tableName]);
  return result.rows;
}

export async function getAllTables(): Promise<string[]> {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

  const result = await dbManager.query(query);
  return result.rows.map((row: any) => row.table_name);
}

export async function executeQuery(
  query: string,
  params?: any[]
): Promise<any> {
  return await dbManager.query(query, params);
}
