import { Command } from "commander";
import { select, text as clackText, isCancel, cancel } from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync, existsSync, readFileSync } from "fs";
import {
  validateAndGetConfig,
  getConfig,
  requiredEnvVars,
} from "../config/env.js";
import { dbManager } from "../database/connection.js";
import { aiManager } from "../ai/chatgpt.js";
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

    // Default action when no subcommand is provided: show command menu
    program.action(async () => {
      await this.showCommandMenu();
    });

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

  private async showCommandMenu(): Promise<void> {
    console.log(chalk.cyan("\nSQL Tool - Select a command to get started:"));

    const selected = await select({
      message: "Choose a command",
      options: [
        { label: "Chat - Start interactive chat mode", value: "chat" },
        {
          label: "Query - Execute a single natural language question",
          value: "query",
        },
        { label: "Setup - Set up environment configuration", value: "setup" },
        { label: "Test - Test database and AI connections", value: "test" },
        { label: "Exit", value: "exit" },
      ],
      initialValue: "chat",
    });
    if (isCancel(selected)) {
      cancel("Operation cancelled.");
      console.log(chalk.cyan("👋 Goodbye!"));
      await this.cleanup();
      process.exit(0);
    }
    console.log("selected: ", selected);

    switch (selected) {
      case "chat":
        await this.initializeApp();
        await this.startInteractiveMode();
        break;
      case "query": {
        const question = await clackText({
          message: chalk.blue("Enter your question:"),
          validate: (input: string) =>
            input.trim().length > 0 ? undefined : "Please enter a question",
        });
        if (isCancel(question)) {
          cancel("Operation cancelled.");
          await this.cleanup();
          process.exit(0);
        }
        await this.initializeApp();
        await this.processQuery(String(question).trim());
        await this.cleanup();
        process.exit(0);
        break;
      }
      case "setup":
        await this.setupEnvironment();
        await this.cleanup();
        process.exit(0);
        break;
      case "test":
        await this.testConnections();
        await this.cleanup();
        process.exit(0);
        break;
      case "exit":
      default:
        console.log(chalk.cyan("👋 Goodbye!"));
        await this.cleanup();
        process.exit(0);
    }
  }

  private async initializeApp(): Promise<void> {
    if (this.isInitialized) return;
    let spinner = ora("Initializing SQL Tool...");
    let connected = false;
    let missingVars: string[] = [];
    while (!connected) {
      try {
        // Validate and get configuration
        const config = await validateAndGetConfig(missingVars);
        spinner.start();

        // Persist configuration to .env (merge/update keys)
        this.updateEnvFile(
          config as unknown as Record<string, string | number | boolean>
        );
        console.log(chalk.green("\n✅ Configuration saved to .env file"));

        spinner.text = "Connecting to database...";
        await dbManager.initialize(config);

        spinner.text = "Connecting to AI model...";
        await aiManager.initialize(config);

        spinner.succeed("SQL Tool initialized successfully!");
        this.isInitialized = true;
        connected = true;
      } catch (error) {
        console.log("error: ", error);
        spinner.fail("Failed to initialize SQL Tool");
        console.log(chalk.yellow("Please setup again"));
        missingVars = requiredEnvVars;
        console.log(chalk.red("Error:"), error);
      }
    }
  }

  private updateEnvFile(
    config: Record<string, string | number | boolean>
  ): void {
    const path = ".env";
    let current = existsSync(path) ? readFileSync(path, "utf8") : "";
    const lines = current.split(/\r?\n/);
    const updatedKeys = new Set<string>();

    // Replace existing keys
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      if (key in config) {
        const value = String(config[key]);
        lines[i] = `${key}=${value}`;
        updatedKeys.add(key);
      }
    }

    // Append missing keys
    for (const [key, value] of Object.entries(config)) {
      if (!updatedKeys.has(key)) {
        lines.push(`${key}=${String(value)}`);
      }
    }

    const content = lines
      .filter(
        (l, idx, arr) => !(l === "" && (idx === 0 || arr[idx - 1] === ""))
      )
      .join("\n");
    writeFileSync(path, content.endsWith("\n") ? content : content + "\n");
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
      const input = await clackText({
        message: chalk.blue("SQL Tool >"),
        validate: (input: string) =>
          input.trim().length > 0
            ? undefined
            : "Please enter a question or command",
      });

      if (isCancel(input)) {
        break;
      }

      const trimmedInput = String(input).trim();
      // Process regular queries
      await this.processQuery(trimmedInput);
    }

    await this.cleanup();
  }

  private async processQuery(question: string): Promise<void> {
    const spinner = ora("Processing your question...").start();

    try {
      // Get database context (table names for better SQL generation)
      // const tablesResult = await dbManager.query(`
      //   SELECT table_name
      //   FROM information_schema.tables
      //   WHERE table_schema = 'public';
      // `);

      // const tableNames = tablesResult.rows.map((row: any) => row.table_name);
      // const context = `Available tables: ${tableNames.join(", ")}`;

      spinner.text = "Generating response...";
      const response = await sqlWorkflow.processInput(question);

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

    // Test AI connection
    const aiSpinner = ora("Testing AI connection...").start();
    try {
      const config = getConfig();
      await aiManager.initialize(config);
      aiSpinner.succeed("AI connection successful");
    } catch (error) {
      aiSpinner.fail("AI connection failed");
      console.error(chalk.red("AI error:"), error);
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

// WARNING: when running by dev command the tsx watch cause SIGN INIT when selecting by using inquirer
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
