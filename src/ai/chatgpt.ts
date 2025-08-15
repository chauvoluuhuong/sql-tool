import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { EnvConfig, getConfig } from "../config/env.js";
import chalk from "chalk";
import { sqlTools } from "../tools/index.js";
import { readFileSync } from "fs";
import { join } from "path";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

class AiManager {
  private model: any;
  private config: EnvConfig | null = null;
  private systemPrompt: string = "";

  async initialize(config: EnvConfig): Promise<void> {
    this.config = config;
    try {
      // Load system prompt
      const systemPromptPath = join(
        process.cwd(),
        "src",
        "prompts",
        "system.md"
      );
      this.systemPrompt = readFileSync(systemPromptPath, "utf-8");

      this.model = new ChatGoogleGenerativeAI({
        apiKey: this.config.GOOGLE_AI_API_KEY,
        model: this.config.MODEL,
      });
      // .bindTools(sqlTools);

      // Add system prompt after model initialization
      const systemMessage = new SystemMessage(this.systemPrompt);

      // Test the connection with a simple query
      const res = await this.model.invoke([
        systemMessage,
        new HumanMessage('Respond with "Connection successful" only.'),
      ]);

      if (!res?.content) {
        throw new Error(
          "No response content from AI model during initialization"
        );
      }

      console.log(
        chalk.green("✅ AI model connection established successfully")
      );
    } catch (error) {
      console.error(chalk.red("❌ Failed to connect to AI model:"), error);
      throw error;
    }
  }

  async generateResponse(message: string, context?: string): Promise<string> {
    if (!this.model) {
      throw new Error("AI model not initialized. Call initialize() first.");
    }

    try {
      let prompt = message;
      if (context) {
        prompt = `Context: ${context}\n\nUser Query: ${message}`;
      }

      const response = await this.model.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(prompt),
      ]);

      return (response.content as string) ?? "";
    } catch (error) {
      console.error(chalk.red("❌ Error generating AI response:"), error);
      throw error;
    }
  }

  async generateSQL(query: string, schema?: string): Promise<string> {
    if (!this.model) {
      throw new Error("AI model not initialized. Call initialize() first.");
    }

    let prompt = `You are a SQL expert. Generate a PostgreSQL query for the following request: "${query}"`;

    if (schema) {
      prompt += `\n\nDatabase Schema:\n${schema}`;
    }

    prompt +=
      "\n\nProvide only the SQL query without any explanation or formatting. The query should be ready to execute.";

    try {
      const response = await this.model.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(prompt),
      ]);

      return (response.content as string) ?? "";
    } catch (error) {
      console.error(chalk.red("❌ Error generating SQL:"), error);
      throw error;
    }
  }

  async explainSQL(sqlQuery: string): Promise<string> {
    if (!this.model) {
      throw new Error("AI model not initialized. Call initialize() first.");
    }

    const prompt = `Explain the following SQL query in simple terms:\n\n${sqlQuery}\n\nProvide a clear, concise explanation of what this query does.`;

    try {
      const response = await this.model.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(prompt),
      ]);

      return (response.content as string) ?? "";
    } catch (error) {
      console.error(chalk.red("❌ Error explaining SQL:"), error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.model !== null;
  }

  getModel(): ChatGoogleGenerativeAI | null {
    return this.model;
  }
}

// Singleton instance
export const aiManager = new AiManager();
