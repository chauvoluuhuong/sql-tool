import { MessagesAnnotation } from "@langchain/langgraph";
import { getModel } from "modules/ai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export async function callModel(state: typeof MessagesAnnotation.State) {
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
export function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  // console.log("lastMessage: ", lastMessage);
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}
