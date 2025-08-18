import { Tool } from "@langchain/core/tools";
import { dbManager } from "../../database/connection";

/**
 * Tool to list all tables in the database
 */
class ListAllTablesTool extends Tool {
  name = "list_all_tables";
  description =
    "List all tables in the database. Use this when you need to see what tables are available.";

  protected async _call(input: string): Promise<string> {
    try {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `;

      const result = await dbManager.query(query);
      const tableNames = result.rows.map((row: any) => row.table_name);

      if (tableNames.length === 0) {
        return "No tables found in the database.";
      }

      return `Tables in database: ${tableNames.join(", ")}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error listing tables: ${errorMessage}`;
    }
  }
}

/**
 * Tool to get schema information for a specific table
 */
class GetTableSchemaTool extends Tool {
  name = "get_table_schema";
  description =
    "Get the schema (column information) for a specific table. Input should be the table name.";

  protected async _call(input: string): Promise<string> {
    try {
      const tableName = input.trim();

      if (!tableName) {
        return "Please provide a table name to get its schema.";
      }

      const query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;

      const result = await dbManager.query(query, [tableName]);

      if (result.rows.length === 0) {
        return `Table '${tableName}' not found or has no columns.`;
      }

      const schemaInfo = result.rows.map((row: any) => {
        const nullable = row.is_nullable === "YES" ? "NULL" : "NOT NULL";
        const length = row.character_maximum_length
          ? `(${row.character_maximum_length})`
          : "";
        const defaultValue = row.column_default
          ? ` DEFAULT ${row.column_default}`
          : "";

        return `${row.column_name} ${row.data_type}${length} ${nullable}${defaultValue}`;
      });

      return `Schema for table '${tableName}':\n${schemaInfo.join("\n")}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error getting table schema: ${errorMessage}`;
    }
  }
}

/**
 * Tool to get first ten records from a specific table
 */
class GetFirstTenRecordsTool extends Tool {
  name = "get_first_ten_records";
  description =
    "Get the first 10 records from a specific table. Input should be the table name.";

  protected async _call(input: string): Promise<string> {
    try {
      const tableName = input.trim();

      if (!tableName) {
        return "Please provide a table name to get records from.";
      }

      // First check if table exists
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `;

      const tableExistsResult = await dbManager.query(tableExistsQuery, [
        tableName,
      ]);
      if (!tableExistsResult.rows[0].exists) {
        return `Table '${tableName}' does not exist.`;
      }

      const query = `SELECT * FROM "${tableName}" LIMIT 10`;
      const result = await dbManager.query(query);

      if (result.rows.length === 0) {
        return `Table '${tableName}' exists but contains no records.`;
      }

      // Format the results in a readable way
      const records = result.rows.map((row: any, index: number) => {
        const rowData = Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return `Record ${index + 1}: {${rowData}}`;
      });

      return `First ${
        result.rows.length
      } records from table '${tableName}':\n${records.join("\n")}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error getting records: ${errorMessage}`;
    }
  }
}

// Export the tools array following the same pattern as shared tools
export const tools = [
  new ListAllTablesTool(),
  new GetTableSchemaTool(),
  new GetFirstTenRecordsTool(),
];
