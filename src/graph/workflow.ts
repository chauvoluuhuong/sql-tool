import { Graph, START, StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import chalk from "chalk";
import { END } from "@langchain/langgraph";
import {
  WorkflowNodeNames,
  WorkflowState,
  chatNode,
  shouldCallToolsNode,
  toolsNode,
  formatResultNode,
  exampleNode,
} from "./nodes.js";

class SQLWorkflow {
  private builder: any;

  constructor() {
    // Initialize the graph builder using the WorkflowState annotation from nodes.js
    this.builder = new StateGraph(WorkflowState)
      .addNode(WorkflowNodeNames.CHAT, chatNode)
      .addNode(WorkflowNodeNames.TOOLS, toolsNode)
      .addNode(WorkflowNodeNames.FORMAT_RESULT, formatResultNode)
      .addNode(WorkflowNodeNames.EXAMPLE_NODE, exampleNode)
      .addEdge(START, WorkflowNodeNames.CHAT)
      .addConditionalEdges(WorkflowNodeNames.CHAT, shouldCallToolsNode as any, {
        [WorkflowNodeNames.TOOLS]: WorkflowNodeNames.TOOLS,
        [WorkflowNodeNames.EXAMPLE_NODE]: WorkflowNodeNames.EXAMPLE_NODE,
      })
      .addEdge(WorkflowNodeNames.EXAMPLE_NODE, END)
      .addEdge(WorkflowNodeNames.TOOLS, WorkflowNodeNames.FORMAT_RESULT)
      .addEdge(WorkflowNodeNames.FORMAT_RESULT, END);
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
