import { config } from "dotenv";
import { existsSync } from "fs";
import {
  text,
  password as clackPassword,
  isCancel,
  cancel,
} from "@clack/prompts";
import chalk from "chalk";

// Load environment variables
config();

export interface EnvConfig {
  OPENAI_API_KEY: string;
  GOOGLE_AI_API_KEY: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  LOG_LEVEL: string;
  MODEL: string;
}

export const requiredEnvVars = [
  "OPENAI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

const ENVIRONMENT_VARIABLES_DEFAULT_VALUES = {
  DB_PORT: "5432",
  DB_SSL: false,
  LOG_LEVEL: "info",
  DB_NAME: "postgres",
  DB_USER: "postgres",
  DB_PASSWORD: "postgres",
  DB_HOST: "localhost",
};

function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("your_") ||
    v.includes("your_database_") ||
    v.includes("your-openai") ||
    v.includes("changeme")
  );
}

export async function validateAndGetConfig(
  missingVars: string[] = []
): Promise<EnvConfig> {
  const config: Partial<EnvConfig> = {};

  // Check which environment variables are missing
  if (missingVars.length === 0) {
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
  }

  if (missingVars.length > 0) {
    console.log(chalk.yellow("\n⚠️  Missing required environment variables:"));
    console.log(chalk.red(missingVars.map((v) => `  - ${v}`).join("\n")));

    if (!existsSync(".env")) {
      console.log(chalk.blue("\n💡 Creating .env file from template..."));
      // We'll handle .env file creation in the CLI
    }

    console.log(chalk.cyan("\nPlease provide the missing values:"));

    for (const varName of missingVars) {
      const hasDefault = varName in ENVIRONMENT_VARIABLES_DEFAULT_VALUES;
      const defaultValue = hasDefault
        ? String(
            ENVIRONMENT_VARIABLES_DEFAULT_VALUES[
              varName as keyof typeof ENVIRONMENT_VARIABLES_DEFAULT_VALUES
            ]
          )
        : undefined;

      const message = hasDefault
        ? `Enter ${varName} (default: ${defaultValue}):`
        : `Enter ${varName}:`;

      const validate = (input: string) => {
        if (!input.trim() && !hasDefault) {
          return `${varName} is required`;
        }
        if (varName === "DB_PORT" && input.trim()) {
          const port = parseInt(input, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            return "Port must be a valid number between 1 and 65535";
          }
        }
        return undefined;
      };

      const promptFn: typeof text = varName.includes("PASSWORD")
        ? (clackPassword as unknown as typeof text)
        : text;
      const answer = await promptFn({
        message,
        initialValue: defaultValue,
        validate,
      });

      if (isCancel(answer)) {
        cancel("Operation cancelled.");
        throw new Error("User cancelled configuration prompts");
      }

      const provided = String(answer ?? "");
      (config as any)[varName] =
        provided.trim() === "" && hasDefault ? defaultValue : provided;
    }

    // Convert DB_PORT to number if provided
    if ((config as any).DB_PORT) {
      config.DB_PORT = parseInt(String((config as any).DB_PORT), 10);
    }
  }

  return config as EnvConfig;
}

export function getConfig(): EnvConfig {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY!,
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: parseInt(process.env.DB_PORT!, 10),
    DB_NAME: process.env.DB_NAME!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_SSL: process.env.DB_SSL?.toLowerCase() === "true",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    MODEL: process.env.MODEL || "gpt-4",
  };
}
