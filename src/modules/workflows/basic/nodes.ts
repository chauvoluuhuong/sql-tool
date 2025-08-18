import { MessagesAnnotation } from "@langchain/langgraph";
import { getModel } from "modules/ai";
import { AIMessage } from "@langchain/core/messages";

export async function callModel(state: typeof MessagesAnnotation.State) {
  const model = getModel();
  const response = await model.invoke(state.messages as any);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define the function that determines whether to continue or not
export function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}
