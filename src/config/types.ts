export enum ModelType {
  OPENAI = "openai",
  GEMINI = "gemini",
}

export interface ModelInfo {
  modelType?: ModelType;
  modelName?: string;
  apiKey?: string;
}

export interface Config {
  modelUsed: ModelInfo;
  [ModelType.OPENAI]: ModelInfo;
  [ModelType.GEMINI]: ModelInfo;
  selectedWorkflowName: string;
}

export const CONFIG_DEFAULT: Config = {
  modelUsed: {
    modelType: ModelType.OPENAI,
    modelName: "gpt-4",
    apiKey: process.env.OPENAI_API_KEY,
  },
  [ModelType.GEMINI]: {
    modelType: ModelType.GEMINI,
    modelName: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
  },
  [ModelType.OPENAI]: {
    modelType: ModelType.OPENAI,
    modelName: "gpt-4",
    apiKey: process.env.OPENAI_API_KEY,
  },
  selectedWorkflowName: "basic",
};
