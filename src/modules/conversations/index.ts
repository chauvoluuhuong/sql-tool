import { CompiledStateGraph, StateGraph } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";
import { text, spinner } from "@clack/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export const conversation = async (
  workflow: CompiledStateGraph<any, any, any, any, any, any>
) => {
  console.log("Type your messages below. Type '/quit' to exit.\n");

  // Initialize conversation state
  let conversationState: typeof MessagesAnnotation.State = {
    messages: [],
  };

  while (true) {
    const userInput = await text({
      message: "🗣️  You:",
      placeholder: "Type your message here...",
    });

    // Check if user cancelled or wants to quit
    if (typeof userInput === "symbol" || userInput.toLowerCase() === "/quit") {
      console.log("\n👋 Goodbye! Conversation ended.");
      break;
    }

    // Skip empty messages
    if (userInput.trim() === "") {
      continue;
    }
    // Show spinner while processing
    const s = spinner();
    try {
      s.start("🤔 Thinking...");

      // Add user message to conversation state
      conversationState.messages.push(new HumanMessage(userInput));

      // Process the user's message with conversation context
      const response = await workflow.invoke(conversationState);

      // Stop the spinner
      s.stop();

      // Update conversation state with the response
      conversationState = response;

      // Display the last assistant message
      const lastAssistantMessage =
        response.messages[response.messages.length - 1];
      console.log("🤖 Assistant:", lastAssistantMessage.content);

      // Check if any tools were used and display them
      const toolMessages = response.messages.filter(
        (msg: AIMessage) =>
          (msg as AIMessage).tool_calls &&
          (msg as AIMessage).tool_calls!.length > 0
      );

      if (toolMessages.length > 0) {
        console.log("\n🔧 Tools used:");
        toolMessages.forEach((msg: AIMessage) => {
          const aiMessage = msg as AIMessage;
          aiMessage.tool_calls?.forEach((toolCall: any) => {
            console.log(
              `  • ${toolCall.name}: ${toolCall.args ? JSON.stringify(toolCall.args) : "No args"}`
            );
          });
        });
      }

      console.log(); // Empty line for better readability
    } catch (error) {
      console.error("❌ Error processing message:", error);
      throw error;
    } finally {
      s.stop();
    }
  }
};
