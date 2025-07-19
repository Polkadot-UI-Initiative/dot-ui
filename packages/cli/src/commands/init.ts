import inquirer from "inquirer";
import ora from "ora";
import execa from "execa";
import path from "path";
import fs from "fs/promises";
import type { CliOptions, ProjectSetupConfig } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { ProjectDetector } from "../utils/project-detector.js";
import { Telemetry } from "../utils/telemetry.js";
import { PolkadotDetector } from "../utils/polkadot-detector.js";

export class InitCommand {
  private projectDetector: ProjectDetector;
  private telemetry: Telemetry;

  constructor(private options: CliOptions) {
    this.projectDetector = new ProjectDetector();
    this.telemetry = new Telemetry(options);
  }

  /**
   * Main init command execution
   */
  async execute(): Promise<void> {
    const startTime = Date.now();
    let setupConfig: ProjectSetupConfig | undefined;

    try {
      logger.info("Initializing new project...");

      // Step 1: Get project configuration
      setupConfig = await this.promptProjectSetup();

      // Track command usage and initialization start
      await this.telemetry.trackCommandUsed("init", {
        framework: setupConfig.framework,
        has_typescript: setupConfig.useTypeScript,
        has_tailwind: setupConfig.useTailwind,
      });

      await this.telemetry.trackProjectInitStarted(setupConfig.framework, {
        has_typescript: setupConfig.useTypeScript,
        has_tailwind: setupConfig.useTailwind,
        project_type: setupConfig.framework,
      });

      // Step 2: Create project structure
      await this.createProject(setupConfig);

      // Step 3: Install Polkadot library
      await this.installPolkadotLibrary(setupConfig);

      // Step 4: Initialize shadcn/ui
      await this.initializeShadcn(setupConfig);

      // Step 5: Success feedback
      this.showSuccessMessage(setupConfig);

      // Track successful initialization
      const duration = Date.now() - startTime;
      await this.telemetry.trackProjectInitCompleted(setupConfig.framework, {
        has_typescript: setupConfig.useTypeScript,
        has_tailwind: setupConfig.useTailwind,
        package_manager: await this.projectDetector.detectPackageManager(),
        duration_ms: duration,
      });
    } catch (error) {
      await this.handleInitializationError(error, setupConfig, startTime);
    }
  }

  /**
   * Interactive project setup prompts
   */
  private async promptProjectSetup(): Promise<ProjectSetupConfig> {
    const currentDir = path.basename(process.cwd());

    // If --yes flag is used, return defaults
    if (this.options.yes) {
      logger.info("Using --yes flag, using default configuration");
      logger.detail(
        "Framework: Next.js with TypeScript, Tailwind CSS, and papi"
      );
      logger.detail("To customize setup, run without --yes flag");

      return this.getDefaultConfig(currentDir);
    }

    return await this.runInteractiveSetup(currentDir);
  }

  /**
   * Get default configuration for --yes flag
   */
  private getDefaultConfig(projectName: string): ProjectSetupConfig {
    return {
      projectName,
      framework: "nextjs",
      useTypeScript: true,
      useESLint: true,
      useTailwind: true,
      useSrcDirectory: false,
      useAppRouter: true,
      useTurbopack: false,
      importAlias: "@/*",
      polkadotLibrary: "papi",
    };
  }

  /**
   * Run interactive setup prompts
   */
  private async runInteractiveSetup(
    currentDir: string
  ): Promise<ProjectSetupConfig> {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "What is your project named?",
        default: currentDir,
        validate: (input: string) => {
          if (!input.trim()) return "Project name cannot be empty";
          if (!/^[a-zA-Z0-9-_]+$/.test(input.trim())) {
            return "Project name can only contain letters, numbers, hyphens, and underscores";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "framework",
        message: "Which framework would you like to use?",
        choices: [
          { name: "Next.js (recommended)", value: "nextjs" },
          { name: "Vite + React", value: "vite" },
        ],
        default: "nextjs",
      },
      {
        type: "confirm",
        name: "useSrcDirectory",
        message: "Would you like your code inside a `src/` directory?",
        default: false,
        when: (answers: any) => answers.framework === "nextjs",
      },
      {
        type: "confirm",
        name: "useAppRouter",
        message: "Would you like to use App Router? (recommended)",
        default: true,
        when: (answers: any) => answers.framework === "nextjs",
      },
      {
        type: "confirm",
        name: "useTurbopack",
        message: "Would you like to use Turbopack for `next dev`?",
        default: false,
        when: (answers: any) => answers.framework === "nextjs",
      },
      {
        type: "confirm",
        name: "customizeImportAlias",
        message:
          "Would you like to customize the import alias (`@/*` by default)?",
        default: false,
        when: (answers: any) => answers.framework === "nextjs",
      },
      {
        type: "input",
        name: "importAlias",
        message: "What import alias would you like configured?",
        default: "@/*",
        when: (answers: any) => answers.customizeImportAlias,
        validate: (input: string) => {
          if (!input.trim()) return "Import alias cannot be empty";
          if (!input.includes("*")) return "Import alias must include *";
          return true;
        },
      },
      // Note: Polkadot library selection is now handled by PolkadotDetector.promptForLibrarySelection()
    ]);

    // Handle Polkadot library selection using the shared utility
    const polkadotDetector = new PolkadotDetector();
    const polkadotLibrary = await polkadotDetector.promptForLibrarySelection({
      skipPrompt: false, // Init command always prompts
      defaultLibrary: "papi",
    });

    return {
      projectName: answers.projectName,
      framework: answers.framework,
      useTypeScript: true, // Always enabled for better DX
      useESLint: true, // Always enabled for code quality
      useTailwind: true, // Always enabled for styling
      useSrcDirectory: answers.useSrcDirectory || false,
      useAppRouter: answers.useAppRouter || false,
      useTurbopack: answers.useTurbopack || false,
      importAlias: answers.importAlias || "@/*",
      polkadotLibrary: polkadotLibrary,
    };
  }

  /**
   * Create a new project based on user configuration
   */
  private async createProject(config: ProjectSetupConfig): Promise<void> {
    const spinner = ora(`Creating ${config.framework} project...`).start();

    try {
      if (config.framework === "nextjs") {
        await this.createNextJsProject(config);
      } else {
        await this.createViteProject(config);
      }

      spinner.succeed(`${config.framework} project created successfully`);
      logger.detail(`Project "${config.projectName}" initialized`);
    } catch (error) {
      spinner.fail("Failed to create project");
      throw new Error(
        `Failed to create ${config.framework} project: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create Next.js project with optimized settings
   */
  private async createNextJsProject(config: ProjectSetupConfig): Promise<void> {
    const args = this.buildNextJsArgs(config);
    const { executable, baseArgs } = await this.getPackageManagerCommand();

    await execa(executable, [...baseArgs, ...args], {
      stdio: "pipe", // Hide verbose output but show errors
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        // Disable telemetry for faster creation
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
  }

  /**
   * Build Next.js CLI arguments
   */
  private buildNextJsArgs(config: ProjectSetupConfig): string[] {
    return [
      "create-next-app@latest",
      ".",
      "--yes",
      config.useTypeScript ? "--typescript" : "--js",
      config.useESLint ? "--eslint" : "--no-eslint",
      config.useTailwind ? "--tailwind" : "--no-tailwind",
      config.useSrcDirectory ? "--src-dir" : "--no-src-dir",
      config.useAppRouter ? "--app" : "--no-app",
      config.useTurbopack ? "--turbo" : "--no-turbo",
      `--import-alias=${config.importAlias}`,
    ];
  }

  /**
   * Create Vite project with React and TypeScript
   */
  private async createViteProject(config: ProjectSetupConfig): Promise<void> {
    const { executable, baseArgs } = await this.getPackageManagerCommand();

    // Create Vite project
    if (this.options.yes) {
      await execa(
        executable,
        [...baseArgs, "create-vite@latest", ".", "--template", "react-ts"],
        {
          stdio: "pipe",
          timeout: 300000,
        }
      );
    } else {
      await execa(executable, [...baseArgs, "create-vite@latest", "."], {
        stdio: "inherit", // Show prompts for interactive mode
        timeout: 300000,
      });
    }

    // Install additional dependencies
    await this.installViteDependencies(config);

    // Configure project files
    await this.configureViteProject(config);
  }

  /**
   * Install additional Vite dependencies
   */
  private async installViteDependencies(
    config: ProjectSetupConfig
  ): Promise<void> {
    const devDeps = [];

    if (config.useESLint) {
      devDeps.push(
        "eslint",
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser"
      );
    }

    if (config.useTailwind) {
      devDeps.push("tailwindcss", "@tailwindcss/vite");
    }

    if (devDeps.length > 0) {
      const installCommand =
        await this.projectDetector.getPackageManagerInstallCommand();
      await execa.command(`${installCommand} -D ${devDeps.join(" ")}`, {
        stdio: "pipe",
        timeout: 300000,
      });
    }
  }

  /**
   * Get package manager run command
   */
  private async getPackageManagerCommand(): Promise<{
    executable: string;
    baseArgs: string[];
  }> {
    const runCommand = await this.projectDetector.getPackageManagerRunCommand();
    const [executable, ...baseArgs] = runCommand.split(" ");
    return { executable, baseArgs };
  }

  /**
   * Configure Vite project files
   */
  private async configureViteProject(
    config: ProjectSetupConfig
  ): Promise<void> {
    const tasks = [];

    if (config.useTailwind) {
      tasks.push(this.updateViteConfig(config));
      tasks.push(this.updateViteCSS(config));
    }

    if (config.useTypeScript) {
      tasks.push(this.updateTsConfig(config));
    }

    await Promise.all(tasks);
  }

  /**
   * Update vite.config.ts for Tailwind CSS v4
   */
  private async updateViteConfig(config: ProjectSetupConfig): Promise<void> {
    const configFile = config.useTypeScript
      ? "vite.config.ts"
      : "vite.config.js";
    const aliasPrefix = config.importAlias.replace("/*", "");

    // Detect project structure to get the correct source directory
    const projectStructure =
      await this.projectDetector.detectProjectStructure();
    const aliasPath =
      projectStructure.srcDir && projectStructure.srcDir !== "."
        ? projectStructure.srcDir
        : ".";

    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "${aliasPrefix}": path.resolve(__dirname, "${aliasPath}"),
    },
  },
})
`;

    await fs.writeFile(configFile, viteConfig);
  }

  /**
   * Update tsconfig.json for import alias
   */
  private async updateTsConfig(config: ProjectSetupConfig): Promise<void> {
    try {
      const tsconfigContent = await fs.readFile("tsconfig.json", "utf-8");
      const tsconfig = JSON.parse(tsconfigContent);

      // Add baseUrl and paths for import alias
      tsconfig.compilerOptions = tsconfig.compilerOptions || {};
      tsconfig.compilerOptions.baseUrl = ".";
      tsconfig.compilerOptions.paths = {
        [config.importAlias]: ["./*"],
      };

      await fs.writeFile("tsconfig.json", JSON.stringify(tsconfig, null, 2));
    } catch (error) {
      logger.warning("Failed to update tsconfig.json for import alias");
      logger.detail("You may need to configure import paths manually");
    }
  }

  /**
   * Update CSS file for Tailwind CSS v4
   */
  private async updateViteCSS(config: ProjectSetupConfig): Promise<void> {
    const cssFile = "src/index.css";
    const tailwindCSS = `@import "tailwindcss";\n`;

    try {
      await fs.writeFile(cssFile, tailwindCSS);
    } catch (error) {
      logger.warning("Failed to update CSS file for Tailwind CSS");
      logger.detail("You may need to add Tailwind imports manually");
    }
  }

  /**
   * Initialize shadcn/ui in the project
   */
  private async initializeShadcn(config: ProjectSetupConfig): Promise<void> {
    const spinner = ora("Initializing shadcn/ui...").start();

    try {
      const { executable, baseArgs } = await this.getPackageManagerCommand();
      const shadcnVersion = "shadcn@canary"; // Use canary for Tailwind v4 support
      const shadcnArgs = this.buildShadcnArgs(config, shadcnVersion);

      await execa(executable, [...baseArgs, ...shadcnArgs], {
        stdio: this.options.yes ? "pipe" : "inherit",
        timeout: 120000, // 2 minutes timeout
      });

      spinner.succeed("shadcn/ui initialized successfully");
      logger.detail("UI components system ready");
    } catch (error) {
      spinner.fail("Failed to initialize shadcn/ui");
      logger.warning("You may need to run 'npx shadcn@canary init' manually");
      logger.detail("This is required before adding components");

      // Don't throw error - this shouldn't stop the entire initialization
      logger.info(
        "Project created successfully despite shadcn/ui initialization issue"
      );
    }
  }

  /**
   * Build shadcn CLI arguments
   */
  private buildShadcnArgs(
    config: ProjectSetupConfig,
    shadcnVersion: string
  ): string[] {
    const args = [shadcnVersion, "init"];

    if (this.options.yes) {
      args.push("--yes", "--base-color", "neutral", "--css-variables");

      if (config.useSrcDirectory) {
        args.push("--src-dir");
      } else {
        args.push("--no-src-dir");
      }
    }

    return args;
  }

  /**
   * Install the selected Polkadot API library
   */
  private async installPolkadotLibrary(
    config: ProjectSetupConfig
  ): Promise<void> {
    const libraryName =
      config.polkadotLibrary === "papi" ? "polkadot-api" : "dedot";
    const spinner = ora(`Installing ${libraryName}...`).start();

    try {
      const packageManager = await this.projectDetector.detectPackageManager();
      const installCommand = packageManager === "npm" ? "install" : "add";

      if (config.polkadotLibrary === "papi") {
        await this.installPapiLibrary(packageManager, installCommand);
        spinner.succeed("polkadot-api installed");
      } else {
        await this.installDedotLibrary(packageManager, installCommand);
        spinner.succeed("dedot and @dedot/chaintypes installed");
        await this.verifyDedotInstallation();
      }

      logger.detail(`${libraryName} ready for blockchain development`);
    } catch (error) {
      spinner.fail(`Failed to install ${libraryName}`);
      throw new Error(
        `Failed to install ${libraryName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Install polkadot-api (papi) library
   */
  private async installPapiLibrary(
    packageManager: string,
    installCommand: string
  ): Promise<void> {
    await execa(
      packageManager,
      [installCommand, "polkadot-api", "@polkadot-api/descriptors"],
      { stdio: "pipe" }
    );
  }

  /**
   * Install dedot library
   */
  private async installDedotLibrary(
    packageManager: string,
    installCommand: string
  ): Promise<void> {
    // Install dedot as regular dependency
    await execa(packageManager, [installCommand, "dedot"], { stdio: "pipe" });

    // Install @dedot/chaintypes as devDependency
    const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
    await execa(
      packageManager,
      [installCommand, devFlag, "@dedot/chaintypes"],
      { stdio: "pipe" }
    );
  }

  /**
   * Verify dedot installation
   */
  private async verifyDedotInstallation(): Promise<void> {
    const spinner = ora("Verifying dedot installation...").start();

    try {
      const packageJsonPath = path.join(process.cwd(), "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );

      const hasDedot = Boolean(packageJson.dependencies?.dedot);
      const hasChainTypes = Boolean(
        packageJson.devDependencies?.["@dedot/chaintypes"]
      );

      if (hasDedot && hasChainTypes) {
        spinner.succeed("Dedot installation verified successfully");
      } else {
        spinner.fail("Dedot installation verification failed");
        throw new Error("Dedot installation is incomplete");
      }
    } catch (error) {
      spinner.fail("Failed to verify dedot installation");
      throw error;
    }
  }

  /**
   * Show success message with next steps
   */
  private showSuccessMessage(config: ProjectSetupConfig): void {
    logger.success("Project initialized successfully!");
    logger.newline();

    logger.subsection("What's been set up:");
    logger.detail(`• ${config.framework} project with TypeScript`, true);
    logger.detail(
      `• ${config.polkadotLibrary === "papi" ? "polkadot-api" : "dedot"} for blockchain integration`,
      true
    );
    logger.detail("• shadcn/ui for beautiful components", true);
    logger.detail("• Tailwind CSS for styling", true);
    logger.newline();

    logger.subsection("Next steps:");
    logger.detail("1. Start development server:", true);
    logger.code(
      `${config.framework === "nextjs" ? "npm run dev" : "npm run dev"}`
    );
    logger.detail("2. Add Polkadot UI components:", true);
    logger.code("polka-ui add block-number");
    logger.detail("3. Check out the documentation:", true);
    logger.code("https://dot-ui.com/docs");
  }

  /**
   * Handle initialization errors with recovery suggestions
   */
  private async handleInitializationError(
    error: unknown,
    setupConfig?: ProjectSetupConfig,
    startTime?: number
  ): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    // Note: Init error tracking not implemented yet
    // Could be added to telemetry interface in the future

    logger.error("Project initialization failed");
    logger.error(errorMessage);
    logger.newline();

    // Provide recovery suggestions based on error type
    this.showRecoverySuggestions(error, setupConfig);

    process.exit(1);
  }

  /**
   * Show recovery suggestions based on error type
   */
  private showRecoverySuggestions(
    error: unknown,
    setupConfig?: ProjectSetupConfig
  ): void {
    const errorMessage = error instanceof Error ? error.message : "";

    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT")
    ) {
      logger.subsection("Network timeout detected:");
      logger.detail("• Check your internet connection", true);
      logger.detail("• Try again with a stable network", true);
      logger.detail("• Consider using a different package manager", true);
    } else if (
      errorMessage.includes("permission") ||
      errorMessage.includes("EACCES")
    ) {
      logger.subsection("Permission error detected:");
      logger.detail(
        "• Ensure you have write permissions in this directory",
        true
      );
      logger.detail("• Try running with appropriate permissions", true);
      logger.detail("• Check if the directory is writable", true);
    } else if (
      errorMessage.includes("space") ||
      errorMessage.includes("ENOSPC")
    ) {
      logger.subsection("Disk space error detected:");
      logger.detail("• Free up disk space", true);
      logger.detail("• Try creating the project in a different location", true);
    } else {
      logger.subsection("Recovery suggestions:");
      logger.detail("• Ensure you have Node.js 16+ installed", true);
      logger.detail("• Try clearing package manager cache", true);
      if (setupConfig?.framework === "nextjs") {
        logger.detail("• Try: npx create-next-app@latest manually", true);
      } else {
        logger.detail("• Try: npm create vite@latest manually", true);
      }
    }
  }
}
