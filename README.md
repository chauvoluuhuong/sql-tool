# SQL Tool - LangGraph.js Powered Database Assistant

An AI-powered SQL tool built with LangGraph.js that provides natural language interface to your PostgreSQL database.

## Features

- 🤖 **AI-Powered SQL Generation**: Convert natural language questions to SQL queries using ChatGPT
- 💬 **Interactive CLI**: Chat-based interface for seamless database interactions
- 🔍 **Database Schema Discovery**: Automatic table and schema exploration
- 🛠️ **LangGraph Workflow**: Sophisticated AI workflow management
- 🔒 **Secure Configuration**: Environment-based credential management
- 📊 **Query Result Formatting**: Beautiful tabular output for query results

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the example environment file and configure your credentials:

```bash
cp env.example .env
```

Edit `.env` with your database and OpenAI credentials:

```env
OPENAI_API_KEY=your_openai_api_key_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_SSL=false
LOG_LEVEL=info
```

### 3. Build and Run

```bash
# Build the project
npm run build

# Start interactive mode
npm start

# Or run directly with tsx (development)
npm run dev
```

## Usage

### Interactive Mode

Start the interactive chat interface:

```bash
npm start
# or
node dist/app.js chat
```

### One-time Queries

Execute a single query:

```bash
node dist/app.js query "Show me all users created in the last 30 days"
```

### Available Commands

- `npm start` or `node dist/app.js chat` - Start interactive mode
- `node dist/app.js query <question>` - Execute single query
- `node dist/app.js setup` - Configure environment
- `node dist/app.js test` - Test database and AI connections

### Interactive Mode Commands

While in interactive mode, you can use these special commands:

- `/help` - Show available commands
- `/tables` - List all database tables
- `/schema <table>` - Show schema for a specific table
- `/exit` - Exit the application

## Project Structure

```
sqlTool/
├── src/
│   ├── ai/
│   │   └── chatgpt.ts          # ChatGPT integration
│   ├── cli/
│   │   └── index.ts            # CLI interface
│   ├── config/
│   │   └── env.ts              # Environment configuration
│   ├── database/
│   │   └── connection.ts       # Database connection management
│   ├── graph/
│   │   └── workflow.ts         # LangGraph workflow
│   └── tools/
│       └── index.ts            # LangGraph tools
├── app.ts                      # Main application entry point
├── tools.ts                    # Tool exports
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Development Scripts

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

### Environment Setup

The application will automatically prompt for missing environment variables on first run. You can also use the setup command:

```bash
npm run dev setup
```

## Example Queries

Once connected, you can ask questions in natural language:

- "Show me all tables in the database"
- "How many users do we have?"
- "Find all orders from the last week"
- "What's the average order value by month?"
- "Show me the schema for the users table"

## Troubleshooting

### Connection Issues

1. **Database Connection Failed**:

   - Verify your database credentials in `.env`
   - Ensure PostgreSQL is running and accessible
   - Check firewall and network settings

2. **ChatGPT Connection Failed**:
   - Verify your OpenAI API key is correct
   - Check your OpenAI account has sufficient credits
   - Ensure network connectivity to OpenAI servers

### Environment Issues

1. **Missing Dependencies**:

   ```bash
   npm install
   ```

2. **TypeScript Compilation Errors**:

   ```bash
   npm run clean
   npm run build
   ```

3. **Permission Issues**:
   ```bash
   chmod +x app.ts
   ```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
