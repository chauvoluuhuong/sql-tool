import { Graph } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { chatGPTManager } from "../ai/chatgpt.js";
import chalk from "chalk";
import { dbManager } from "../database/connection.js";

// Define the workflow state
interface WorkflowState {
  messages: BaseMessage[];
  currentQuery?: string;
  sqlResult?: any;
  context?: string;
}

class SQLWorkflow {
  private builder: any;

  constructor() {
    // Initialize the graph builder
    this.builder = new (Graph as any)();
    this.setupNodes();
    this.setupEdges();
  }

  private setupNodes(): void {
    // Chat node - handles general conversation and SQL generation
    this.builder.addNode("chat", async (state: any) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const userInput = lastMessage.content as string;

      console.log(chalk.blue("🤖 Processing your request..."));

      try {
        // Determine if this is a SQL-related query
        const isSQLQuery = this.isSQLRelated(userInput);

        if (isSQLQuery) {
          // Generate SQL
          const sqlQuery = await chatGPTManager.generateSQL(
            userInput,
            state.context
          );

          return {
            messages: [
              ...state.messages,
              new AIMessage(
                `I'll generate a SQL query for your request: "${userInput}"\n\nGenerated SQL:\n\`\`\`sql\n${sqlQuery}\n\`\`\``
              ),
            ],
            currentQuery: sqlQuery,
          };
        } else {
          // Handle general conversation
          const response = await chatGPTManager.generateResponse(
            userInput,
            state.context
          );

          return {
            messages: [...state.messages, new AIMessage(response)],
          };
        }
      } catch (error) {
        console.error(chalk.red("❌ Error in chat node:"), error);
        return {
          messages: [
            ...state.messages,
            new AIMessage(
              "I apologize, but I encountered an error processing your request. Please try again."
            ),
          ],
        };
      }
    });

    // Execute SQL node - runs the generated SQL query against the DB
    this.builder.addNode("executeSQL", async (state: any) => {
      if (!state.currentQuery) {
        return state;
      }
      try {
        const result = await dbManager.query(state.currentQuery);
        return { ...state, sqlResult: result };
      } catch (error) {
        console.error(chalk.red("❌ Error executing SQL:"), error);
        return {
          messages: [
            ...state.messages,
            new AIMessage(
              "There was an error executing the generated SQL. Please review the query and try again."
            ),
          ],
        };
      }
    });

    // Result formatter node
    this.builder.addNode("formatResult", async (state: any) => {
      if (state.sqlResult) {
        const formattedResult = this.formatQueryResult(state.sqlResult);

        return {
          messages: [
            ...state.messages,
            new AIMessage(`Query executed successfully!\n\n${formattedResult}`),
          ],
        };
      }

      return state;
    });
  }

  private setupEdges(): void {
    // Entry
    this.builder.addEdge("__start__", "chat");

    // Conditional edge: if we have a generated query, execute it; otherwise end
    this.builder.addConditionalEdges("chat", (state: any) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage instanceof AIMessage && state.currentQuery) {
        return "executeSQL";
      }
      return "__end__";
    });

    // After execution, format result, then end
    this.builder.addEdge("executeSQL", "formatResult");
    this.builder.addEdge("formatResult", "__end__");
  }

  private isSQLRelated(input: string): boolean {
    const sqlKeywords = [
      "select",
      "insert",
      "update",
      "delete",
      "create",
      "drop",
      "alter",
      "table",
      "database",
      "query",
      "sql",
      "find",
      "show",
      "get",
      "list",
      "count",
      "sum",
      "average",
      "max",
      "min",
      "join",
      "where",
      "group by",
    ];

    const inputLower = input.toLowerCase();
    return sqlKeywords.some((keyword) => inputLower.includes(keyword));
  }

  private formatQueryResult(result: any): string {
    if (!result || !result.rows) {
      return "No results found.";
    }

    const rows = result.rows;
    if (rows.length === 0) {
      return "Query executed successfully, but no rows were returned.";
    }

    // Format as a simple table
    const headers = Object.keys(rows[0]);
    let output = "\n";

    // Add headers
    output += "| " + headers.join(" | ") + " |\n";
    output += "|" + headers.map(() => "---").join("|") + "|\n";

    // Add rows (limit to first 10 for readability)
    const displayRows = rows.slice(0, 10);
    for (const row of displayRows) {
      output +=
        "| " +
        headers.map((header) => String(row[header] || "")).join(" | ") +
        " |\n";
    }

    if (rows.length > 10) {
      output += `\n... and ${rows.length - 10} more rows.`;
    }

    output += `\nTotal rows: ${rows.length}`;

    return output;
  }

  getGraph() {
    return this.builder.compile();
  }

  async processInput(input: string, context?: string): Promise<string> {
    const compiledGraph = this.getGraph();

    const initialState = {
      messages: [new HumanMessage(input)],
      context: context,
    } as any;

    try {
      const result = await compiledGraph.invoke(initialState);
      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage.content as string;
    } catch (error) {
      console.error(chalk.red("❌ Error in workflow:"), error);
      return "I apologize, but I encountered an error processing your request. Please try again.";
    }
  }
}

// Singleton instance
export const sqlWorkflow = new SQLWorkflow();
