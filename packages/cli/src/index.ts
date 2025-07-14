#!/usr/bin/env node

import { Command } from "commander";
import { AddCommand } from "./commands/add.js";
import { ListCommand } from "./commands/list.js";
import { logger } from "./utils/logger.js";
import { CliOptions } from "./types/index.js";

const program = new Command();

// CLI metadata
program
  .name("dot-ui")
  .description(
    "CLI for installing Polkadot UI components with automatic API setup"
  )
  .version("0.1.0");

// Global options
program
  .option("--dev", "Use development registry (localhost:3000)")
  .option("--verbose", "Show detailed output")
  .option("--force", "Force installation even if files exist");

// Add command
program
  .command("add")
  .description("Add a component to your project")
  .argument("<component>", "Component name to install")
  .action(async (componentName: string) => {
    const options: CliOptions = {
      dev: program.opts().dev,
      verbose: program.opts().verbose,
      force: program.opts().force,
    };

    const addCommand = new AddCommand(options);
    await addCommand.execute(componentName);
  });

// List command
program
  .command("list")
  .description("List all available components")
  .action(async () => {
    const options: CliOptions = {
      dev: program.opts().dev,
      verbose: program.opts().verbose,
      force: program.opts().force,
    };

    const listCommand = new ListCommand(options);
    await listCommand.execute();
  });

// Help command
program
  .command("help")
  .description("Show help information")
  .action(() => {
    program.help();
  });

// Error handling
program.exitOverride((err) => {
  if (err.exitCode === 0) {
    // Normal exit (help command, etc.)
    process.exit(0);
  }

  if (err.code === "commander.unknownCommand") {
    logger.error(`Unknown command: ${err.message.split("'")[1]}`);
    logger.info('Run "dot-ui help" to see available commands');
    process.exit(1);
  }

  if (err.code === "commander.missingArgument") {
    logger.error(err.message);
    logger.info('Run "dot-ui help" to see command usage');
    process.exit(1);
  }

  // Other commander errors
  logger.error(err.message);
  process.exit(1);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Unexpected error occurred:");
  logger.error(error.message);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:");
  logger.error(reason instanceof Error ? reason.message : String(reason));
  if (program.opts().verbose && reason instanceof Error) {
    console.error(reason.stack);
  }
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

// Parse arguments
program.parse(process.argv);
