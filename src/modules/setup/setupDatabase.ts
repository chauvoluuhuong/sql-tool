import { text, select, note, spinner } from "@clack/prompts";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { DatabaseConfig, dbManager } from "../database/connection";
import { createEnvConfig, EnvConfig, loadEnvConfig } from "../../config/config";

export async function setupDatabase(): Promise<boolean> {
  const s = spinner();

  try {
    note("🔧 Database Setup - Configure your PostgreSQL database connection");
    const envConfig = loadEnvConfig();
    // Get database configuration from user
    const dbHost = await text({
      message: "Database host:",
      placeholder: "localhost",
      initialValue: envConfig.DB_HOST,
    });

    if (!dbHost) {
      console.log(chalk.red("❌ Database host is required"));
      return false;
    }

    const dbPort = await text({
      message: "Database port:",
      placeholder: "5432",
      initialValue: envConfig.DB_PORT.toString(),
    });

    if (!dbPort) {
      console.log(chalk.red("❌ Database port is required"));
      return false;
    }

    const dbName = await text({
      message: "Database name:",
      placeholder: "postgres",
      initialValue: envConfig.DB_NAME,
    });

    if (!dbName) {
      console.log(chalk.red("❌ Database name is required"));
      return false;
    }

    const dbUser = await text({
      message: "Database username:",
      placeholder: "postgres",
      initialValue: envConfig.DB_USER,
    });

    if (!dbUser) {
      console.log(chalk.red("❌ Database username is required"));
      return false;
    }

    const dbPassword = await text({
      message: "Database password:",
      placeholder: "Enter your database password",
      initialValue: envConfig.DB_PASSWORD,
    });

    if (!dbPassword) {
      console.log(chalk.red("❌ Database password is required"));
      return false;
    }

    const useSSL = await select({
      message: "Use SSL connection?",
      options: [
        { value: "true", label: "Yes" },
        { value: "false", label: "No" },
      ],
      initialValue: "false",
    });

    s.start("Testing database connection...");
    const config: DatabaseConfig = {
      DB_HOST: dbHost as string,
      DB_PORT: parseInt(dbPort as string),
      DB_NAME: dbName as string,
      DB_USER: dbUser as string,
      DB_PASSWORD: dbPassword as string,
      DB_SSL: useSSL === "true",
    };
    // Initialize database connection
    await dbManager.initialize(config);

    s.stop(chalk.green("✅ Database connection successful!"));

    // Build .env content
    const envContent = createEnvConfig({
      dbHost,
      dbPort,
      dbName,
      dbUser,
      dbPassword,
      dbSsl: useSSL,
    });

    // Show connection info
    note(
      `Database connected to: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`
    );

    // Write to .env file
    writeFileSync(join(process.cwd(), ".env"), envContent, "utf8");
    console.log(chalk.green("✅ .env file created/updated successfully"));

    return true;
  } catch (error) {
    s.stop(chalk.red("❌ Database connection failed"));
    console.error(chalk.red("Connection error:"), error);
    return false;
  }
}
