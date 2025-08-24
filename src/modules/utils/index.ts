import { dirname, join } from "path";
import { fileURLToPath } from "url";

// get relate file path from the file call this function
export const getRelateFilePath = (directories: string[]) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, ...directories);
};
