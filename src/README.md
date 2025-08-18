# LangGraph Interactive AI Assistant

A TypeScript LangGraph application that provides an interactive AI assistant with conversation memory, supporting both OpenAI and Google Gemini models with a beautiful CLI interface.

## Features

- 🤖 **Interactive AI Assistant**: Chat with an AI that maintains conversation memory
- 🧠 **Conversation Memory**: The AI remembers the full conversation context
- 🔧 **Built-in Tools**: Calculator, web search, and file operations
- 🎨 **Beautiful CLI Interface**: Powered by [Clack](https://www.clack.cc/) for an intuitive experience
- 🔐 **Secure Credential Management**: Store API keys in `.env` files
- 📝 **TypeScript Support**: Full type safety and modern development experience
- 🔄 **LangGraph Workflow**: Powered by LangGraph for robust AI agent orchestration

## Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key (for GPT models) or Google AI API key (for Gemini)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Application

```bash
# Development mode with interactive menu
npm run dev

# Or build and run
npm run build
npm start
```

The application will present you with a menu to choose between:

- **Setup/Configure Model & Credentials**: Configure your AI model and API keys
- **Show Workflow Diagram**: View the LangGraph workflow structure
- **Run Interactive AI Assistant**: Start chatting with the AI assistant

## Interactive AI Assistant

Once you start the interactive assistant, you can:

- 💬 **Chat naturally**: Ask questions and have conversations
- 🧮 **Use tools**: The AI can perform calculations, search the web, and work with files
- 📚 **Maintain context**: The AI remembers your entire conversation
- 🚪 **Easy exit**: Type `/quit` to end the conversation

### Available Tools

The AI assistant has access to several tools:

- **Calculator**: Perform mathematical calculations
- **Web Search**: Search the internet for current information
- **File Operations**: Read and write files (when needed)

## Configuration

The setup process creates separate credential files for each provider:

```env
# .env.openai
OPENAI_API_KEY=sk-your-key-here
MODEL_TYPE=openai
MODEL_NAME=your-model-name

# .env.gemini
GOOGLE_API_KEY=AIza-your-key-here
MODEL_TYPE=gemini
MODEL_NAME=your-model-name
```

This separation allows you to easily switch between different providers without reconfiguring.

## API Key Sources

- **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Google AI**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Project Structure

```
langgrapjs/
├── app.ts          # Main application with integrated setup menu
├── workflow.ts     # LangGraph workflow and interactive assistant
├── tools.ts        # AI tools and functions
├── setup.ts        # Setup and configuration logic
├── config.json     # Application configuration
├── package.json    # Dependencies and scripts
├── .env.openai     # OpenAI credentials (created by setup)
└── .env.gemini     # Gemini credentials (created by setup)
```

## Scripts

- `npm run dev` - Run in development mode with integrated setup menu
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run built application
- `npm run clean` - Clean build artifacts

## Technologies Used

- [LangGraph](https://langchain-ai.github.io/langgraph/) - AI workflow orchestration
- [Clack](https://www.clack.cc/) - Beautiful CLI components
- [LangChain](https://langchain.com/) - AI application framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript

## LangGraph Workflow

The application uses LangGraph to create a robust AI agent workflow:

1. **Agent Node**: Processes user input and decides whether to use tools
2. **Tools Node**: Executes tools when needed (calculator, search, etc.)
3. **Conditional Routing**: Automatically routes between agent and tools based on AI decisions
4. **State Management**: Maintains conversation state across interactions

## Security Notes

- API keys are stored in `.env` files (automatically ignored by git)
- Never commit your `.env` file to version control
- The setup script validates API key formats before saving

## Troubleshooting

### "No valid credentials found"

Run the application and select "Setup/Configure Model & Credentials" to configure your model and API keys.

### "API key environment variable is not set"

Ensure you've completed the setup process and your credential files exist.

### Invalid API key format

The setup process validates API key formats. Make sure you're using the correct key type for your selected model.

### Conversation not maintaining context

The conversation state is automatically managed by LangGraph. If you're experiencing issues, try restarting the application.

## Example Usage

```
🤖 Interactive AI Assistant with Memory
Type your messages below. Type '/quit' to exit.

🗣️  You: What's 15 * 23?
🤔 Thinking...
✅ Response ready
🤖 Assistant: 15 * 23 = 345

🔧 Tools used:
  • calculator: {"expression": "15 * 23"}

🗣️  You: What about 345 + 100?
🤔 Thinking...
✅ Response ready
🤖 Assistant: 345 + 100 = 445

🔧 Tools used:
  • calculator: {"expression": "345 + 100"}

🗣️  You: /quit
👋 Goodbye! Conversation ended.
```
