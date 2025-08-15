import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { chatGPTManager } from "../ai/chatgpt.js";
import chalk from "chalk";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { sqlTools } from "../tools/index.js";
import { END, Annotation } from "@langchain/langgraph";

// Enum for node names
export enum WorkflowNodeNames {
  CHAT = "chat",
  SHOULD_CALL_TOOLS = "shouldCallTools",
  TOOLS = "tools",
  FORMAT_RESULT = "formatResult",
  EXAMPLE_NODE = "exampleNode",
}

// Define the workflow state using Annotation.Root
export const WorkflowState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
  }),
  currentQuery: Annotation<string | undefined>(),
  sqlResult: Annotation<any>(),
  context: Annotation<string | undefined>(),
});

// Type inference from the annotation
export type WorkflowState = typeof WorkflowState.State;

// Chat node - handles general conversation and SQL generation
export async function chatNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userInput = lastMessage.content as string;

  console.log(chalk.blue("🤖 Processing your request..."));

  try {
    // Use the agent directly with tool binding to generate tool calls
    const model = chatGPTManager.getModel();
    if (!model) {
      throw new Error("ChatGPT model not initialized");
    }

    const response = await model.invoke([{ role: "user", content: userInput }]);

    // Ensure response is properly typed as BaseMessage
    const aiMessage =
      response instanceof AIMessage
        ? response
        : new AIMessage(
            typeof response.content === "string"
              ? response.content
              : JSON.stringify(response.content)
          );

    return {
      messages: [...state.messages, aiMessage],
    };
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
export function shouldCallToolsNode(
  state: WorkflowState
): WorkflowNodeNames.TOOLS | "__end__" {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  const hasToolCalls =
    last?.tool_calls &&
    Array.isArray(last.tool_calls) &&
    last.tool_calls.length > 0;
  return hasToolCalls ? WorkflowNodeNames.TOOLS : END;
}

export function exampleNode(state: WorkflowState) {
  console.log("example node");
  return {
    messages: [...state.messages, new AIMessage("Hello, world!")],
  };
}

// Tools node - executes SQL tools
export const toolsNode = new ToolNode(sqlTools);

// Format result node - formats query results
export async function formatResultNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  // Get the last tool message (result from tools)
  const lastMessage = state.messages[state.messages.length - 1];

  // If the last message contains tool results, format them nicely
  if (lastMessage && "content" in lastMessage && lastMessage.content) {
    try {
      // Try to parse tool results and format them
      const content = lastMessage.content as string;

      // If it looks like a tool result with SQL data, format it
      if (content.includes('"success":true') && content.includes('"data"')) {
        const toolResult = JSON.parse(content);
        if (toolResult.success && toolResult.data && toolResult.data.rows) {
          const formattedResult = formatQueryResult(toolResult.data);

          return {
            messages: [
              ...state.messages,
              new AIMessage(
                `Query executed successfully!\n\n${formattedResult}`
              ),
            ],
          };
        }
      }
    } catch (error) {
      // If parsing fails, just pass through the original message
      console.log("Could not parse tool result, using original message");
    }
  }

  // If we have sqlResult in state (legacy), use it
  if (state.sqlResult) {
    const formattedResult = formatQueryResult(state.sqlResult);

    return {
      messages: [
        ...state.messages,
        new AIMessage(`Query executed successfully!\n\n${formattedResult}`),
      ],
    };
  }

  // Otherwise, just return the current state
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
