import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
// Load environment variables
import "dotenv/config";
import { tools } from "modules/shared/tools";
import { buildModel } from "modules/ai";
import { loadCredentials } from "modules/setup/setupModel";
import { callModel } from "./nodes";
import { shouldContinue } from "./nodes";

export const buildWorkflow = async () => {
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
