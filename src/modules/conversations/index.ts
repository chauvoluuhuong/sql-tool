import { CompiledStateGraph, StateGraph, Command } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";
import { text, spinner } from "@clack/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import queriesData from "../workflows/sql-workflow/queries.json";
import { QueryDescription } from "../workflows/sql-workflow/types";
import { SqlWorkflowStateType } from "../workflows/sql-workflow/index";
import { v4 as uuidv4 } from "uuid";
export const conversation = async (
  workflow: CompiledStateGraph<any, any, any, any, any, any>
) => {
  console.log("Type your messages below. Type '/quit' to exit.\n");

  const config = {
    configurable: {
      thread_id: uuidv4(),
    },
  };

  console.log("you are in thread id:", config.configurable.thread_id);

  // Load queries from JSON file
  const rawQueries: QueryDescription[] = queriesData as QueryDescription[];

  // Initialize conversation state with all required fields
  let conversationState: SqlWorkflowStateType = {
    messages: [],
    toolResults: [],
    generateQueryRequest: "",
    generateQueryRequestContext: {
      description: "",
    },
    queryGenerated: "",
    rawQueries: rawQueries,
  };
  let userInput;
  let response;
  while (true) {
    userInput = await text({
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
      response = await workflow.invoke(conversationState, config);

      // Stop the spinner
      s.stop();

      while (response.__interrupt__) {
        console.log(
          "🤖 Assistant:",
          response.__interrupt__
            .map((interrupt: { id: string; value: string }) => interrupt.value)
            .join(", ")
        );
        userInput = await text({
          message: "🗣️  You:",
          placeholder: "Type your message here...",
        });

        response = await workflow.invoke(
          new Command({ resume: userInput }),
          config
        );
      }
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
        console.log("\n🔧 latest tool used:");
        const latestTool = toolMessages[toolMessages.length - 1];
        const latestToolCall = latestTool.tool_calls?.[0];
        console.log(
          `  • ${latestToolCall?.name}: ${
            latestToolCall?.args
              ? JSON.stringify(latestToolCall?.args)
              : "No args"
          }`
        );

        // toolMessages.forEach((msg: AIMessage) => {
        //   const aiMessage = msg as AIMessage;
        //   aiMessage.tool_calls?.forEach((toolCall: any) => {
        //     console.log(
        //       `  • ${toolCall.name}: ${
        //         toolCall.args ? JSON.stringify(toolCall.args) : "No args"
        //       }`
        //     );
        //   });
        // });
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
