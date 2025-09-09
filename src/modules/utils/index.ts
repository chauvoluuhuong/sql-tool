import { dirname, join } from "path";
import { fileURLToPath } from "url";

// get relate file path from the file call this function
export const getRelateFilePath = (directories: string[]) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, ...directories);
};

export function parseModelResponse(raw: string, schema: any) {
  // 1. Remove Markdown code fences if present
  const cleaned = raw
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();

  // 2. Parse JSON safely
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error("Invalid JSON from model: " + err);
  }

  // 3. Validate against schema
  return schema.parse(parsed);
}
