import { Tool } from "@langchain/core/tools";
import { dbManager } from "../../database/connection";

/**
 * Generic tool to execute raw SQL queries
 */
class GenericQueryTool extends Tool {
  name = "genericQuery";
  description =
    "Execute raw SQL queries. Input should be a JSON string with 'rawQuery' (the SQL query to execute) and 'queryParams' (array of parameters for the query).";

  protected async _call(input: string): Promise<string> {
    try {
      const inputData = JSON.parse(input);
      const { rawQuery, queryParams = [] } = inputData;

      if (!rawQuery) {
        return "Please provide a 'rawQuery' field with the SQL query to execute.";
      }

      // Execute the query
      const result = await dbManager.query(rawQuery, queryParams);

      // Format the response
      return this.formatQueryResult(result, queryParams);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return "Invalid JSON input. Please provide a JSON string with 'rawQuery' and 'queryParams' fields.";
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error executing query: ${errorMessage}`;
    }
  }

  private formatQueryResult(result: any, queryParams: any[]): string {
    if (result.rows.length === 0) {
      return "Query executed successfully but returned no results.";
    }

    // Format the results in a readable way
    const records = result.rows.map((row: any, index: number) => {
      const rowData = Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      return `Record ${index + 1}: {${rowData}}`;
    });

    return `Query executed successfully. Returned ${
      result.rows.length
    } row(s):\n${records.join("\n")}`;
  }
}

// Export the tools array with the single generic query tool
export const tools = [new GenericQueryTool()];
