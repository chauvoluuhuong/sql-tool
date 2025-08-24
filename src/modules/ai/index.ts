import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ModelType, Config } from "../../config/types";
import { tools } from "src/modules/shared/tools";
import { Tool } from "@langchain/core/tools";
import { loadEnvConfigFromFile } from "@/config/config";
import { SystemMessage } from "@langchain/core/messages";

var model: any;
export const buildModel = (
  credentials: Config,
  toolsProvided: Tool[] = tools
  // systemPrompt?: SystemMessage
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

  // if (systemPrompt) {
  //   model = model.bind({ systemMessage: systemPrompt });
  // }

  return model;
};

export const getModel = () => {
  return model;
};
