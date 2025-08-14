import { Graph, START } from "@langchain/langgraph";
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
} from "./nodes.js";

class SQLWorkflow {
  private builder: any;

  constructor() {
    // Initialize the graph builder
    this.builder = new Graph();
    this.setupNodes();
    this.setupEdges();
  }

  private setupNodes(): void {
    this.builder.addNode(chatNode);
    this.builder.addNode(toolsNode);
    this.builder.addNode(formatResultNode);
  }

  private setupEdges(): void {
    this.builder.addEdge(START, chatNode);
    this.builder.addConditionalEdges(chatNode, shouldCallToolsNode);
    this.builder.addConditionalEdges(toolsNode, formatResultNode);
    this.builder.addEdge(formatResultNode, END);
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
