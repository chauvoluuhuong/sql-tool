export interface EnvConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
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
  return {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'postgres',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_SSL: process.env.DB_SSL === 'true'
  };
}

// Load app config from JSON
export function loadAppConfig(): AppConfig {
  // This would typically load from a config file or environment
  return {
    modelUsed: {
      modelType: "openai",
      modelName: "gpt-4"
    },
    gemini: {
      modelType: "gemini",
      modelName: "gemini-2.5-flash"
    },
    openai: {
      modelType: "openai",
      modelName: "gpt-4"
    }
  };
}
