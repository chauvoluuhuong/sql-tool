import { HumanMessage } from "@langchain/core/messages";
import { InterruptWorkflowStateType } from "./index";
import { interrupt } from "@langchain/langgraph";
/**
 * Node that needs human approval - demonstrates interrupt pattern
 * Note: In a real scenario with proper checkpointer setup, this would use interrupt()
 */
export const humanRevisionNode = async (state: InterruptWorkflowStateType) => {
  const value = interrupt("you need to input something");

  console.log("user input:", value);

  return { messages: [new HumanMessage(value)] };
};
