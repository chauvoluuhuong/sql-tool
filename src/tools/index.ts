import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  dbManager,
  executeQuery,
  getTableSchema,
  getAllTables,
} from "../database/connection.js";
import chalk from "chalk";

// Schema validation schemas
const ExecuteQuerySchema = z.object({
  query: z.string().describe("The SQL query to execute"),
  params: z
    .array(z.any())
    .optional()
    .describe("Optional parameters for the query"),
});

const GetTableSchemaSchema = z.object({
  tableName: z.string().describe("The name of the table to get schema for"),
});

// Execute SQL Query Tool
export const executeQueryTool = tool(
  async ({ query, params = [] }) => {
    try {
      console.log(chalk.blue("🔍 Executing SQL query..."));
      console.log(chalk.gray(`Query: ${query}`));

      const result = await executeQuery(query, params);

      console.log(
        chalk.green(
          `✅ Query executed successfully. ${
            result.rows?.length || 0
          } rows returned.`
        )
      );

      return {
        success: true,
        data: result,
        rowCount: result.rows?.length || 0,
        message: "Query executed successfully",
      };
    } catch (error) {
      console.error(chalk.red("❌ Query execution failed:"), error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Query execution failed",
      };
    }
  },
  {
    name: "execute_query",
    description: "Execute a SQL query against the connected database",
    schema: ExecuteQuerySchema,
  }
);

// Get Table Schema Tool
export const getTableSchemaTool = tool(
  async ({ tableName }) => {
    try {
      console.log(chalk.blue(`🔍 Getting schema for table: ${tableName}`));

      const schema = await getTableSchema(tableName);

      if (schema.length === 0) {
        return {
          success: false,
          message: `Table '${tableName}' not found`,
          data: [],
        };
      }

      console.log(
        chalk.green(
          `✅ Retrieved schema for table '${tableName}' with ${schema.length} columns`
        )
      );

      return {
        success: true,
        data: schema,
        message: `Schema retrieved for table '${tableName}'`,
      };
    } catch (error) {
      console.error(chalk.red("❌ Failed to get table schema:"), error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to retrieve table schema",
      };
    }
  },
  {
    name: "get_table_schema",
    description: "Get the schema information for a specific table",
    schema: GetTableSchemaSchema,
  }
);

// Get All Tables Tool
export const getAllTablesTool = tool(
  async () => {
    try {
      console.log(chalk.blue("🔍 Getting list of all tables..."));

      const tables = await getAllTables();

      console.log(chalk.green(`✅ Retrieved ${tables.length} tables`));

      return {
        success: true,
        data: tables,
        message: `Found ${tables.length} tables in the database`,
      };
    } catch (error) {
      console.error(chalk.red("❌ Failed to get tables:"), error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to retrieve table list",
      };
    }
  },
  {
    name: "get_all_tables",
    description: "Get a list of all tables in the database",
    schema: z.object({}),
  }
);

// Test Database Connection Tool
export const testConnectionTool = tool(
  async () => {
    try {
      console.log(chalk.blue("🔍 Testing database connection..."));

      const result = await executeQuery("SELECT 1 as test");

      console.log(chalk.green("✅ Database connection is working"));

      return {
        success: true,
        message: "Database connection is working",
        data: result,
      };
    } catch (error) {
      console.error(chalk.red("❌ Database connection test failed:"), error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Database connection test failed",
      };
    }
  },
  {
    name: "test_connection",
    description: "Test the database connection",
    schema: z.object({}),
  }
);

// Export all tools as an array
export const sqlTools = [
  executeQueryTool,
  getTableSchemaTool,
  getAllTablesTool,
  testConnectionTool,
];
