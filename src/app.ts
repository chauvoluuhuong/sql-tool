import { intro, outro, select } from "@clack/prompts";
import { setupModel } from "modules/setup/setupModel";
import { setupDatabase } from "modules/setup/setupDatabase";
import { conversation } from "modules/conversations";
import { readdir } from "fs/promises";
import { join } from "path";
import { loadAppConfig, writeAppConfig } from "./config/config";
import { CONFIG_DEFAULT } from "./config/types";

async function getWorkflowDynamically(workflowName: string) {
  const workflowModule = await import(`modules/workflows/${workflowName}`);
  if (!workflowModule.buildWorkflow) {
    console.log(
      `❌ buildWorkflow function not found in ${workflowName} -> you should implement it`
    );
    return null;
  }
  return await workflowModule.buildWorkflow();
}

async function selectWorkflow() {
  try {
    // Read all directories in modules/workflows
    const workflowsDir = join(process.cwd(), "src", "modules", "workflows");
    const entries = await readdir(workflowsDir, { withFileTypes: true });

    const config = loadAppConfig();
    // Filter for directories only (exclude files like index.ts)
    const workflowFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    if (workflowFolders.length === 0) {
      console.log("❌ No workflow folders found in modules/workflows");
      return null;
    }

    // Create options for the select prompt
    const workflowOptions = workflowFolders.map((folder) => ({
      value: folder,
      label:
        folder.charAt(0).toUpperCase() + folder.slice(1).replace(/-/g, " "), // Capitalize and replace hyphens
    }));

    // Let user select a workflow
    const selectedWorkflow = await select({
      message: "Select a workflow to build:",
      options: workflowOptions,
    });

    if (!selectedWorkflow) {
      console.log("❌ No workflow selected");
      return null;
    }

    const selectedWorkflowName = String(selectedWorkflow);

    config.selectedWorkflowName = selectedWorkflowName;
    writeAppConfig(config);
    // Build and return the workflow
    console.log(`🔨 Building ${selectedWorkflowName} workflow...`);

    console.log(`✅ ${selectedWorkflowName} workflow built successfully!`);

    return getWorkflowDynamically(selectedWorkflowName);
  } catch (error) {
    console.error("❌ Error selecting workflow:", error);
    return null;
  }
}

async function main() {
  // Check for command line arguments
  const args = process.argv.slice(2);
  const commandArg = args[0];

  // Original interactive mode
  intro("🤖 LangGraph Application");
  let workflow;
  let config = CONFIG_DEFAULT;
  try {
    config = loadAppConfig();
    if (config.selectedWorkflowName) {
      workflow = await getWorkflowDynamically(config.selectedWorkflowName);
      intro(`Using default workflow: ${config.selectedWorkflowName}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Can't build default workflow: ${error.message}`);
    } else {
      console.warn(`Can't build default workflow: ${error}`);
    }
  }
  let choice;
  let initialized = false;
  while (true) {
    try {
      config = loadAppConfig();
    } catch (error) {
      console.error("❌ Error loading config:", error);
      console.log(
        "+++++++++++++++++Try to setup again+++++++++++++++++++++++++++++"
      );
      config = CONFIG_DEFAULT;
    }
    try {
      if (!initialized && commandArg) {
        choice = commandArg as any;
      } else {
        choice = await select({
          message: "What would you like to do?",
          options: [
            {
              value: "setupModel",
              label: "Setup/Configure Model & Credentials",
            },
            { value: "setupDatabase", label: "Setup/Configure Database" },
            { value: "selectWorkflow", label: "Select Workflow" },
            {
              value: "viewWorkflow",
              label: "View LangGraph Workflow Diagram",
            },
            { value: "runConversation", label: "Chat with the Workflow" },
            { value: "exit", label: "Exit Application" },
          ],
        });
      }
      initialized = true;

      if (choice === "setupModel") {
        const success = await setupModel();
        if (success) {
          console.log("✅ Setup complete! 🎉");
        } else {
          console.log("❌ Setup failed or was cancelled.");
        }
        console.log("\n"); // Add spacing before returning to menu
      } else if (choice === "setupDatabase") {
        const success = await setupDatabase();
        if (success) {
          console.log("✅ Database setup complete! 🎉");
        } else {
          console.log("❌ Database setup failed or was cancelled.");
        }

        console.log("\n"); // Add spacing before returning to menu
      } else if (choice === "viewWorkflow") {
        if (!workflow && config.selectedWorkflowName) {
          workflow = await getWorkflowDynamically(config.selectedWorkflowName);
        }
        if (!workflow) {
          throw new Error("Please select workflow first");
        }
        const graph = await workflow.getGraphAsync();
        console.log(graph.drawMermaid());
        console.log("\n"); // Add spacing before returning to menu
      } else if (choice === "runConversation") {
        if (!workflow && config.selectedWorkflowName) {
          workflow = await getWorkflowDynamically(config.selectedWorkflowName);
        }
        if (!workflow) {
          throw new Error("Please select workflow first");
        }
        await conversation(workflow);
        console.log("\n"); // Add spacing before returning to menu
      } else if (choice === "selectWorkflow") {
        workflow = await selectWorkflow();
      } else if (choice === "exit") {
        outro("Goodbye! 👋");
        process.exit(0);
      } else {
        console.log("No option selected.");
        console.log("\n"); // Add spacing before returning to menu
      }
    } catch (error) {
      console.error(error);
      console.log(
        "+++++++++++++++++Try to setup again+++++++++++++++++++++++++++++"
      );
    }
  }
}

main().catch((error) => {
  console.error("Application failed:", error);
  process.exit(1);
});
