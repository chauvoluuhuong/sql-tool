import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ModelType, Config } from "src/modules/setup/setupModel";
import { tools } from "src/modules/shared/tools";
import { Tool } from "@langchain/core/tools";
import { loadEnvConfigFromFile } from "@/config/config";

var model: any;
export const buildModel = (
  credentials: Config,
  toolsProvided: Tool[] = tools
) => {
  loadEnvConfigFromFile();

  if (credentials.modelUsed?.modelType === ModelType.OPENAI) {
    model = new ChatOpenAI({
      model: credentials.modelUsed.modelName || "gpt-4",
      temperature: 0,
    });
  } else if (credentials.modelUsed?.modelType === ModelType.GEMINI) {
    model = new ChatGoogleGenerativeAI({
      model: credentials.modelUsed.modelName || "gemini-2.5-flash",
      temperature: 0,
    });
  } else {
    console.error(
      `Error: Unknown MODEL_TYPE '${credentials.modelUsed?.modelType}'`
    );
    return;
  }

  if (toolsProvided) {
    model = model.bindTools(toolsProvided);
  }

  return model;
};

export const getModel = () => {
  return model;
};
