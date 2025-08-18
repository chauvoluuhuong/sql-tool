import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
// Load environment variables
import "dotenv/config";
import { tools } from "./tools";
import { buildModel } from "modules/ai";
import { loadCredentials } from "modules/setup/setupModel";
import { callModel } from "./nodes";
import { shouldContinue } from "./nodes";
import { dbManager } from "@/modules/database/connection";

export const buildWorkflow = async () => {
  await dbManager.initialize();
  const credentials = await loadCredentials();
  const model = buildModel(credentials, tools);
  if (!model) {
    throw new Error("Failed to create model");
  }
  // Define the tools for the agent to use
  const toolNode = new ToolNode(tools);

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
    .addNode("tools", toolNode)
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .compile();
};
