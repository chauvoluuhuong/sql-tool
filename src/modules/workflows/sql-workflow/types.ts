import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

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
  description?: string;
}

export const SqlWorkflowState = Annotation.Root({
  messages: Annotation<BaseMessage[]>,
  toolResults: Annotation<ToolResult[]>,
  // the model requests to generate a query
  requestGenerateQuery: Annotation<boolean>,
  queryGenerated: Annotation<string>,
  properQueryFound: Annotation<string>,
  // does user accept to generate query or not
  onRequestGenerateQuery: Annotation<boolean>,
  // the model query schema table or provided from user to generate query
  generateQueryContext: Annotation<string>,
});

export const OutPutStructureSchema = z.object({
  queryGenerated: z.string().describe("the model generated query"),
  properQueryFound: z
    .string()
    .describe(
      "the query found in based knowledge base matched with request of user"
    ),
  queryUsedToGetContext: z
    .string()
    .describe(
      "the query found in knowledge base or provided by user to get context"
    ),
  queryParams: z
    .record(z.string(), z.string())
    .describe("the parameters of the query"),
});
