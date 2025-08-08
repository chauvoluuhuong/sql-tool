import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
import inquirer from "inquirer";
import chalk from "chalk";

// Load environment variables
config();

export interface EnvConfig {
  OPENAI_API_KEY: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  LOG_LEVEL: string;
}

const requiredEnvVars = [
  "OPENAI_API_KEY",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("your_") ||
    v.includes("your_database_") ||
    v.includes("your-openai") ||
    v.includes("changeme")
  );
}

export async function validateAndGetConfig(): Promise<EnvConfig> {
  const missingVars: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Check which environment variables are missing
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (!value || value.trim() === "" || isPlaceholder(value)) {
      missingVars.push(envVar);
    } else {
      switch (envVar) {
        case "DB_PORT":
          config.DB_PORT = parseInt(value, 10);
          break;
        case "DB_SSL":
          config.DB_SSL = value.toLowerCase() === "true";
          break;
        default:
          (config as any)[envVar] = value;
      }
    }
  }

  // Set defaults for optional variables
  config.DB_SSL = config.DB_SSL ?? false;
  config.LOG_LEVEL = process.env.LOG_LEVEL || "info";

  if (missingVars.length > 0) {
    console.log(chalk.yellow("\n⚠️  Missing required environment variables:"));
    console.log(chalk.red(missingVars.map((v) => `  - ${v}`).join("\n")));

    if (!existsSync(".env")) {
      console.log(chalk.blue("\n💡 Creating .env file from template..."));
      // We'll handle .env file creation in the CLI
    }

    console.log(chalk.cyan("\nPlease provide the missing values:"));

    const answers = await inquirer.prompt(
      missingVars.map((varName) => ({
        type: varName.includes("PASSWORD") ? "password" : "input",
        name: varName,
        message: `Enter ${varName}:`,
        validate: (input: string) => {
          if (!input.trim()) {
            return `${varName} is required`;
          }
          if (varName === "DB_PORT") {
            const port = parseInt(input, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
              return "Port must be a valid number between 1 and 65535";
            }
          }
          return true;
        },
      }))
    );

    // Update config with user-provided values
    Object.assign(config, answers);

    // Convert DB_PORT to number if provided
    if ((answers as any).DB_PORT) {
      config.DB_PORT = parseInt((answers as any).DB_PORT, 10);
    }
  }

  return config as EnvConfig;
}

export function getConfig(): EnvConfig {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: parseInt(process.env.DB_PORT!, 10),
    DB_NAME: process.env.DB_NAME!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_SSL: process.env.DB_SSL?.toLowerCase() === "true",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
  };
}
