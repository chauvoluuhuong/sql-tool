import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  interrupt,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
const checkpointer = new MemorySaver();
// Load environment variables
import "dotenv/config";
import { humanRevisionNode } from "./nodes";

// Define simple state for interrupt workflow
export const InterruptWorkflowState = Annotation.Root({
  messages: Annotation<string[]>,
});

export type InterruptWorkflowStateType = typeof InterruptWorkflowState.State;

export const buildWorkflow = async () => {
  console.log("Building simple interrupt workflow...");

  return new StateGraph(InterruptWorkflowState)
    .addNode("human_revision", humanRevisionNode)
    .addEdge("__start__", "human_revision")
    .compile({
      checkpointer,
    });
};

// Export types for compatibility
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
