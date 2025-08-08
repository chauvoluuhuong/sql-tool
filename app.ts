#!/usr/bin/env node

import { SQLToolCLI } from "./src/cli/index.js";

// Create and run the CLI application
const cli = new SQLToolCLI();
cli.run();
