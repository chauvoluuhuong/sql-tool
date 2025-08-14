import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { chatGPTManager } from "../ai/chatgpt.js";
import chalk from "chalk";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { sqlTools } from "../tools/index.js";
import { END } from "@langchain/langgraph";

// Enum for node names
export enum WorkflowNodeNames {
  CHAT = "chat",
  SHOULD_CALL_TOOLS = "shouldCallTools",
  TOOLS = "tools",
  FORMAT_RESULT = "formatResult",
}

// Define the workflow state interface
export interface WorkflowState {
  messages: BaseMessage[];
  currentQuery?: string;
  sqlResult?: any;
  context?: string;
}

// Chat node - handles general conversation and SQL generation
export async function chatNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userInput = lastMessage.content as string;

  console.log(chalk.blue("🤖 Processing your request..."));

  try {
    const response = await chatGPTManager.generateResponse(
      userInput,
      state.context
    );
    // Note: The response handling seems incomplete in the original code
    // You may need to add the actual response to messages
    return {
      messages: [...state.messages, new AIMessage(response)],
    }; // Placeholder - adjust based on actual implementation
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
}

// Should call tools node - determines if tools should be invoked
export async function shouldCallToolsNode(
  state: WorkflowState
): Promise<string> {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  const hasToolCalls =
    last?.tool_calls &&
    Array.isArray(last.tool_calls) &&
    last.tool_calls.length > 0;
  return hasToolCalls ? WorkflowNodeNames.TOOLS : END;
}

// Tools node - executes SQL tools
export const toolsNode = new ToolNode(sqlTools);

// Format result node - formats query results
export async function formatResultNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (state.sqlResult) {
    const formattedResult = formatQueryResult(state.sqlResult);

    return {
      messages: [
        ...state.messages,
        new AIMessage(`Query executed successfully!\n\n${formattedResult}`),
      ],
    };
  }

  return state;
}

// Helper function to format query results
function formatQueryResult(result: any): string {
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
