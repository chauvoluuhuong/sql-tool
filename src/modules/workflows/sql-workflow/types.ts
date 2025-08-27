import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface QueryParameterDescription {
  description: string;
  name: string;
  required: boolean;
}

export interface QueryDescription {
  queryName: string;
  query: string;
  description: string;
  parameters?: QueryParameterDescription[];
}

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
  rawQueries: Annotation<QueryDescription[]>,
});
