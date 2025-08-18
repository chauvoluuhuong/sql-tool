import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

import dotenv from "dotenv";
import path from "path";

export const loadEnvConfigFromFile = () => {
  const envPath = path.join(process.cwd(), ".env");
  dotenv.config({ path: envPath });
  return dotenv.parse(readFileSync(envPath, "utf8"));
};

export interface EnvConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
}

export interface ModelConfig {
  modelType: string;
  modelName: string;
}

export interface AppConfig {
  modelUsed: ModelConfig;
  gemini: ModelConfig;
  openai: ModelConfig;
}

// Load environment variables
export function loadEnvConfig(): EnvConfig {
  const envConfig = loadEnvConfigFromFile();
  return {
    DB_HOST: envConfig.DB_HOST || "localhost",
    DB_PORT: parseInt(envConfig.DB_PORT || "5432"),
    DB_NAME: envConfig.DB_NAME || "postgres",
    DB_USER: envConfig.DB_USER || "postgres",
    DB_PASSWORD: envConfig.DB_PASSWORD || "",
    DB_SSL: envConfig.DB_SSL === "true",
    OPENAI_API_KEY: envConfig.OPENAI_API_KEY || "",
    GOOGLE_API_KEY: envConfig.GOOGLE_API_KEY || "",
  };
}

export const createEnvConfig = ({
  dbHost,
  dbPort,
  dbName,
  dbUser,
  dbPassword,
  dbSsl,
  openaiApiKey,
  googleApiKey,
}: any) => {
  const config = loadEnvConfig();
  return `
  # CONFIG FOR DATABASE
  DB_HOST=${dbHost || config.DB_HOST}
  DB_PORT=${dbPort || config.DB_PORT}
  DB_NAME=${dbName || config.DB_NAME}
  DB_USER=${dbUser || config.DB_USER}
  DB_PASSWORD=${dbPassword || config.DB_PASSWORD}
  DB_SSL=${dbSsl || config.DB_SSL}

  # CONFIG FOR AI MODELS
  OPENAI_API_KEY=${openaiApiKey || config.OPENAI_API_KEY}
  GOOGLE_API_KEY=${googleApiKey || config.GOOGLE_API_KEY}
  `;
};

export const writeEnvConfig = (envConfig: string) => {
  writeFileSync(join(process.cwd(), ".env"), envConfig, "utf8");
};

// Load app config from JSON
export function loadAppConfig(): AppConfig {
  // This would typically load from a config file or environment
  return {
    modelUsed: {
      modelType: "openai",
      modelName: "gpt-4",
    },
    gemini: {
      modelType: "gemini",
      modelName: "gemini-2.5-flash",
    },
    openai: {
      modelType: "openai",
      modelName: "gpt-4",
    },
  };
}
