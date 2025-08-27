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
import { SqlWorkflowState } from "./types";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
// Define custom state for SQL workflow

export type SqlWorkflowStateType = typeof SqlWorkflowState.State;

export const buildWorkflow = async () => {
  const checkpointer = new MemorySaver();
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
    .compile({ checkpointer });
};
