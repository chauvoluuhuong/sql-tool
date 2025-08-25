import { getModel } from "modules/ai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SqlWorkflowStateType, ToolResult } from "./index";
import { tools } from "./tools";

export async function callModel(state: SqlWorkflowStateType) {
  const model = getModel();

  // Read the system prompt from the markdown file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const systemPromptPath = join(__dirname, "systemPrompt.md");
  const systemPromptContent = readFileSync(systemPromptPath, "utf-8");

  // Create a ChatPromptTemplate with the system message and user messages
  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", systemPromptContent],
    new MessagesPlaceholder("messages"),
  ]);

  // Format the prompt with the current messages
  const formattedMessages = await promptTemplate.formatMessages({
    messages: state.messages,
  });

  const response = await model.invoke(formattedMessages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define the function that determines whether to continue or not
export function shouldContinue({ messages }: SqlWorkflowStateType) {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  // console.log("lastMessage: ", lastMessage);
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

// Custom tool execution node that captures results and stores them in state
export async function executeTools(state: SqlWorkflowStateType) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    return { messages: [], toolResults: [] };
  }

  const responses = [];
  const toolResults: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const tool = tools.find((t) => t.name === toolCall.name);

    if (!tool) {
      const errorMsg = `Tool '${toolCall.name}' not found`;
      const toolResult: ToolResult = {
        toolName: toolCall.name,
        result: errorMsg,
        timestamp: new Date(),
        success: false,
        error: errorMsg,
      };

      toolResults.push(toolResult);
      responses.push({
        type: "tool" as const,
        content: errorMsg,
        tool_call_id: toolCall.id,
      });
      continue;
    }

    try {
      // Execute the tool
      const result = await tool.invoke(toolCall.args);

      // Store the result in toolResults
      const toolResult: ToolResult = {
        toolName: toolCall.name,
        result: result,
        timestamp: new Date(),
        success: true,
      };

      toolResults.push(toolResult);

      // Create response message for the conversation
      responses.push({
        type: "tool" as const,
        content: result,
        tool_call_id: toolCall.id,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Store the error in toolResults
      const toolResult: ToolResult = {
        toolName: toolCall.name,
        result: null,
        timestamp: new Date(),
        success: false,
        error: errorMessage,
      };

      toolResults.push(toolResult);

      // Create error response message
      responses.push({
        type: "tool" as const,
        content: `Error executing ${toolCall.name}: ${errorMessage}`,
        tool_call_id: toolCall.id,
      });
    }
  }

  return {
    messages: responses,
    toolResults: toolResults,
  };
}
