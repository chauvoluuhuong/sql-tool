import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
// Load environment variables
import "dotenv/config";
import { tools } from "./tools";
import { buildModel } from "modules/ai";
import { loadCredentials } from "modules/setup/setupModel";
import { callModel, shouldContinue, executeTools } from "./nodes";
import { dbManager } from "@/modules/database/connection";

// Define custom state for SQL workflow
export interface ToolResult {
  toolName: string;
  result: any;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface GenerateQueryRequestContext {
  contextData?: string;
  description: string;
}

export const SqlWorkflowState = Annotation.Root({
  messages: Annotation<BaseMessage[]>,
  toolResults: Annotation<ToolResult[]>,
  generateQueryRequest: Annotation<string>,
  generateQueryRequestContext: Annotation<GenerateQueryRequestContext>,
  queryGenerated: Annotation<string>,
});

export type SqlWorkflowStateType = typeof SqlWorkflowState.State;

export const buildWorkflow = async () => {
  await dbManager.initialize();
  const credentials = await loadCredentials();

  const model = buildModel(credentials, tools);
  if (!model) {
    throw new Error("Failed to create model");
  }
  return new StateGraph(SqlWorkflowState)
    .addNode("agent", callModel)
    .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
    .addNode("tools", executeTools)
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .compile();
};
