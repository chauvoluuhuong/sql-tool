# Test Interrupt Workflow

This is a simple example of a LangGraph workflow that demonstrates interrupt functionality, allowing human intervention during workflow execution.

## Overview

The workflow follows this pattern:

1. **Process Text Node**: Processes the initial text and increments a step counter
2. **Human Revision Node**: Creates an interrupt, pausing the workflow for human input
3. **Resume**: Human provides revised text, workflow continues and completes

## Files

- `index.ts` - Main workflow definition with state and graph construction
- `nodes.ts` - Node functions including the interrupt node
- `example.ts` - Basic example demonstrating the workflow pattern (simulated interrupt)
- `interrupt-example.ts` - Full example with actual interrupt functionality
- `types.ts` - TypeScript type definitions
- `tools.ts` - Tool definitions (not used in this simple example)
- `queries.json` - Query templates (not used in this simple example)
- `systemPrompt.md` - System prompt (not used in this simple example)

## Examples

### Basic Example (Simulated Interrupt)

The basic example demonstrates the workflow pattern without requiring a checkpointer:

```bash
npx tsx src/modules/workflows/test-interrupt/example.ts
```

This example simulates the interrupt pattern and shows how the workflow would behave.

### Full Interrupt Example

The full example demonstrates actual interrupt functionality with proper checkpointer setup:

```bash
npx tsx src/modules/workflows/test-interrupt/interrupt-example.ts
```

This example shows the complete interrupt pattern with error handling and resume functionality.

## Usage

### Basic Example

```typescript
import { buildWorkflow } from "./index";

// Build the workflow
const graph = await buildWorkflow();

// Run the workflow
const result = await graph.invoke({
  text_to_revise: "Initial text to revise",
  step_count: 0,
});
```

### Handling Interrupts

The workflow will pause at the `humanRevisionNode` and throw an `InterruptError`. You can handle this and resume the workflow:

```typescript
try {
  const result = await graph.invoke(initialState, threadConfig);
  console.log("Workflow completed:", result);
} catch (error) {
  if (error.name === "InterruptError") {
    console.log("Workflow interrupted:", error.interrupt);

    // Resume with human input
    const { Command } = await import("@langchain/langgraph/pregel");
    const resumeResult = await graph.invoke(
      new Command.Resume("Human revised text"),
      threadConfig
    );
  }
}
```

## State Structure

The workflow uses this state structure:

```typescript
{
  messages: BaseMessage[],        // Chat messages (not used in this example)
  text_to_revise: string,        // Text that needs human revision
  revised_text: string,          // Text after human revision
  step_count: number,           // Counter for processing steps
}
```

## Key Features

- **Interrupt Pattern**: Uses `interrupt()` function to pause workflow execution
- **Human Intervention**: Allows human input during workflow execution
- **Resume Capability**: Can resume workflow with human-provided data
- **Thread Persistence**: Uses thread configuration to maintain state across invocations
- **Checkpointer Support**: Supports memory-based checkpointing for interrupt functionality

## Integration with Main Application

This workflow can be integrated into the main SQL tool application by:

1. Importing the `buildWorkflow` function
2. Adding interrupt handling to the CLI interface
3. Providing a way for users to provide input when the workflow pauses
4. Resuming the workflow with user input

## Example Integration

```typescript
// In your main application
import { buildWorkflow } from "modules/workflows/test-interrupt";

const workflow = await buildWorkflow();

// Handle interrupts in your CLI
try {
  await workflow.invoke(input, threadConfig);
} catch (error) {
  if (error.name === "InterruptError") {
    // Prompt user for input
    const userInput = await promptUser("Please revise the text:");

    // Resume workflow
    const { Command } = await import("@langchain/langgraph/pregel");
    await workflow.invoke(new Command.Resume(userInput), threadConfig);
  }
}
```

## Notes

- The basic example (`example.ts`) simulates the interrupt pattern for demonstration purposes
- The full example (`interrupt-example.ts`) requires proper checkpointer setup and demonstrates actual interrupt functionality
- The interrupt functionality requires a checkpointer (MemorySaver) to work properly
- The Command.Resume functionality is part of the LangGraph pregel module
