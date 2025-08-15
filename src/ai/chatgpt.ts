import { ChatOpenAI } from "@langchain/openai";
import { EnvConfig } from "../config/env.js";
import chalk from "chalk";
import { sqlTools } from "../tools/index.js";

class ChatGPTManager {
  private model: ChatOpenAI | null = null;
  private config: EnvConfig | null = null;

  async initialize(config: EnvConfig): Promise<void> {
    this.config = config;
    try {
      this.model = new ChatOpenAI({
        apiKey: config.OPENAI_API_KEY,
        model: "gpt-4o",
        temperature: 0.1,
        maxTokens: 2000,
      });
      this.model.bindTools(sqlTools);

      // Test the connection with a simple query
      const res = await this.model.invoke([
        { role: "user", content: 'Respond with "Connection successful" only.' },
      ]);

      if (!res?.content) {
        throw new Error(
          "No response content from ChatOpenAI during initialization"
        );
      }

      console.log(
        chalk.green("✅ ChatGPT connection established successfully")
      );
    } catch (error) {
      console.error(chalk.red("❌ Failed to connect to ChatGPT:"), error);
      throw error;
    }
  }

  async generateResponse(message: string, context?: string): Promise<string> {
    if (!this.model) {
      throw new Error("ChatGPT not initialized. Call initialize() first.");
    }

    try {
      let prompt = message;
      if (context) {
        prompt = `Context: ${context}\n\nUser Query: ${message}`;
      }

      const response = await this.model.invoke([
        { role: "user", content: prompt },
      ]);

      return (response.content as string) ?? "";
    } catch (error) {
      console.error(chalk.red("❌ Error generating ChatGPT response:"), error);
      throw error;
    }
  }

  async generateSQL(query: string, schema?: string): Promise<string> {
    if (!this.model) {
      throw new Error("ChatGPT not initialized. Call initialize() first.");
    }

    let prompt = `You are a SQL expert. Generate a PostgreSQL query for the following request: "${query}"`;

    if (schema) {
      prompt += `\n\nDatabase Schema:\n${schema}`;
    }

    prompt +=
      "\n\nProvide only the SQL query without any explanation or formatting. The query should be ready to execute.";

    try {
      const response = await this.model.invoke([
        { role: "user", content: prompt },
      ]);

      return (response.content as string) ?? "";
    } catch (error) {
      console.error(chalk.red("❌ Error generating SQL:"), error);
      throw error;
    }
  }

  async explainSQL(sqlQuery: string): Promise<string> {
    if (!this.model) {
      throw new Error("ChatGPT not initialized. Call initialize() first.");
    }

    const prompt = `Explain the following SQL query in simple terms:\n\n${sqlQuery}\n\nProvide a clear, concise explanation of what this query does.`;

    try {
      const response = await this.model.invoke([
        { role: "user", content: prompt },
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

  getModel(): ChatOpenAI | null {
    return this.model;
  }
}

// Singleton instance
export const chatGPTManager = new ChatGPTManager();
