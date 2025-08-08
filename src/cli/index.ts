import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync, existsSync } from "fs";
import { validateAndGetConfig, getConfig } from "../config/env.js";
import { dbManager } from "../database/connection.js";
import { chatGPTManager } from "../ai/chatgpt.js";
import { sqlWorkflow } from "../graph/workflow.js";

const program = new Command();

export class SQLToolCLI {
  private isInitialized = false;

  constructor() {
    this.setupCommands();
  }

  private setupCommands(): void {
    program
      .name("sql-tool")
      .description("AI-powered SQL tool with LangGraph.js")
      .version("1.0.0");

    // Interactive mode command
    program
      .command("chat")
      .alias("c")
      .description("Start interactive chat mode")
      .action(async () => {
        await this.initializeApp();
        await this.startInteractiveMode();
      });

    // One-time query command
    program
      .command("query <question>")
      .alias("q")
      .description("Execute a single query")
      .action(async (question: string) => {
        await this.initializeApp();
        await this.processQuery(question);
      });

    // Setup command
    program
      .command("setup")
      .description("Set up environment configuration")
      .action(async () => {
        await this.setupEnvironment();
      });

    // Test connections command
    program
      .command("test")
      .description("Test database and AI connections")
      .action(async () => {
        await this.testConnections();
      });
  }

  private async initializeApp(): Promise<void> {
    if (this.isInitialized) return;

    const spinner = ora("Initializing SQL Tool...").start();

    try {
      // Validate and get configuration
      const config = await validateAndGetConfig();

      // Save configuration to .env file if it doesn't exist
      if (!existsSync(".env")) {
        const envContent = Object.entries(config)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n");
        writeFileSync(".env", envContent);
        console.log(chalk.green("\n✅ Configuration saved to .env file"));
      }

      spinner.text = "Connecting to database...";
      await dbManager.initialize(config);

      spinner.text = "Connecting to ChatGPT...";
      await chatGPTManager.initialize(config);

      spinner.succeed("SQL Tool initialized successfully!");
      this.isInitialized = true;
    } catch (error) {
      spinner.fail("Failed to initialize SQL Tool");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  }

  private async startInteractiveMode(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Welcome to SQL Tool Interactive Mode!"));
    console.log(
      chalk.gray(
        "Type your questions in natural language, and I'll help you with SQL queries."
      )
    );
    console.log(
      chalk.gray("Commands: /help, /tables, /schema <table>, /exit\n")
    );

    while (true) {
      try {
        const { input } = await inquirer.prompt([
          {
            type: "input",
            name: "input",
            message: chalk.blue("SQL Tool >"),
            validate: (input: string) =>
              input.trim().length > 0 || "Please enter a question or command",
          },
        ]);

        const trimmedInput = input.trim();

        // Handle special commands
        if (trimmedInput.startsWith("/")) {
          await this.handleCommand(trimmedInput);
          continue;
        }

        // Process regular queries
        await this.processQuery(trimmedInput);
      } catch (error) {
        if (error && typeof error === "object" && "isTtyError" in error) {
          // User pressed Ctrl+C
          break;
        }
        console.error(chalk.red("Error:"), error);
      }
    }

    await this.cleanup();
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.split(" ");

    switch (cmd) {
      case "/help":
        console.log(chalk.cyan("\nAvailable commands:"));
        console.log(chalk.white("  /help          - Show this help message"));
        console.log(
          chalk.white("  /tables        - List all tables in the database")
        );
        console.log(
          chalk.white("  /schema <table> - Show schema for a specific table")
        );
        console.log(chalk.white("  /exit          - Exit the application"));
        console.log(
          chalk.gray("\nOr just type your question in natural language!\n")
        );
        break;

      case "/tables":
        try {
          const result = await dbManager.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
          `);

          console.log(chalk.green("\n📋 Available tables:"));
          result.rows.forEach((row: any) => {
            console.log(chalk.white(`  • ${row.table_name}`));
          });
          console.log();
        } catch (error) {
          console.error(chalk.red("Failed to retrieve tables:"), error);
        }
        break;

      case "/schema":
        if (!args[0]) {
          console.log(
            chalk.yellow("Please specify a table name: /schema <table_name>")
          );
          break;
        }

        try {
          const tableName = args[0];
          const result = await dbManager.query(
            `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position;
          `,
            [tableName]
          );

          if (result.rows.length === 0) {
            console.log(chalk.yellow(`Table '${tableName}' not found.`));
            break;
          }

          console.log(chalk.green(`\n📋 Schema for table '${tableName}':`));
          result.rows.forEach((row: any) => {
            const nullable =
              row.is_nullable === "YES" ? "(nullable)" : "(required)";
            const defaultVal = row.column_default
              ? ` default: ${row.column_default}`
              : "";
            console.log(
              chalk.white(
                `  • ${row.column_name}: ${row.data_type} ${nullable}${defaultVal}`
              )
            );
          });
          console.log();
        } catch (error) {
          console.error(chalk.red("Failed to retrieve schema:"), error);
        }
        break;

      case "/exit":
        console.log(chalk.cyan("👋 Goodbye!"));
        await this.cleanup();
        process.exit(0);
        break;

      default:
        console.log(
          chalk.yellow(
            `Unknown command: ${cmd}. Type /help for available commands.`
          )
        );
    }
  }

  private async processQuery(question: string): Promise<void> {
    const spinner = ora("Processing your question...").start();

    try {
      // Get database context (table names for better SQL generation)
      const tablesResult = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      `);

      const tableNames = tablesResult.rows.map((row: any) => row.table_name);
      const context = `Available tables: ${tableNames.join(", ")}`;

      spinner.text = "Generating response...";
      const response = await sqlWorkflow.processInput(question, context);

      spinner.succeed("Response generated!");
      console.log(chalk.green("\n🤖 AI Response:"));
      console.log(chalk.white(response));
      console.log();
    } catch (error) {
      spinner.fail("Failed to process query");
      console.error(chalk.red("Error:"), error);
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log(chalk.cyan("🔧 Setting up SQL Tool environment..."));

    try {
      const config = await validateAndGetConfig();

      const envContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

      writeFileSync(".env", envContent);
      console.log(chalk.green("✅ Configuration saved to .env file"));

      // Test connections
      await this.testConnections();
    } catch (error) {
      console.error(chalk.red("❌ Setup failed:"), error);
    }
  }

  private async testConnections(): Promise<void> {
    console.log(chalk.cyan("\n🔍 Testing connections..."));

    // Test database connection
    const dbSpinner = ora("Testing database connection...").start();
    try {
      const config = existsSync(".env")
        ? getConfig()
        : await validateAndGetConfig();
      await dbManager.initialize(config);
      dbSpinner.succeed("Database connection successful");
    } catch (error) {
      dbSpinner.fail("Database connection failed");
      console.error(chalk.red("Database error:"), error);
      return;
    }

    // Test ChatGPT connection
    const aiSpinner = ora("Testing ChatGPT connection...").start();
    try {
      const config = getConfig();
      await chatGPTManager.initialize(config);
      aiSpinner.succeed("ChatGPT connection successful");
    } catch (error) {
      aiSpinner.fail("ChatGPT connection failed");
      console.error(chalk.red("ChatGPT error:"), error);
      return;
    }

    console.log(chalk.green("\n✅ All connections are working!"));
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.blue("🧹 Cleaning up..."));
    await dbManager.close();
  }

  run(): void {
    program.parse();
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log(
    chalk.yellow("\n\n⚠️  Received interrupt signal. Cleaning up...")
  );
  await dbManager.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log(
    chalk.yellow("\n\n⚠️  Received termination signal. Cleaning up...")
  );
  await dbManager.close();
  process.exit(0);
});
