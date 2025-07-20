import inquirer from "inquirer";
import ora from "ora";
import execa from "execa";
import path from "path";
import fs from "fs/promises";
import type { CliOptions, ProjectSetupConfig } from "../types/index.js";
import { createLogger, Logger } from "../utils/logger.js";
import { ProjectDetector } from "../utils/project-detector.js";
import { Telemetry } from "../utils/telemetry.js";
import { PolkadotDetector } from "../utils/polkadot-detector.js";

export class InitCommand {
  private projectDetector: ProjectDetector;
  private telemetry: Telemetry;
  private logger: Logger;

  constructor(
    private options: CliOptions,
    private context: "standalone" | "from-add" = "standalone"
  ) {
    this.logger = createLogger(options.verbose);
    this.logger.detail(
      "🏗️ InitCommand constructor - Initializing InitCommand with options: " +
        JSON.stringify(options) +
        " context: " +
        context
    );
    this.projectDetector = new ProjectDetector();
    this.telemetry = new Telemetry(options);
    this.logger.detail("✅ InitCommand constructor - InitCommand ready");
  }

  /**
   * Main init command execution
   */
  async execute(): Promise<void> {
    this.logger.detail("🚀 InitCommand.execute() - Starting init command");
    const startTime = Date.now();
    let setupConfig: ProjectSetupConfig | undefined;

    try {
      this.logger.info("Initializing new project...");

      // Step 1: Get project configuration
      this.logger.detail("📋 Step 1: Getting project configuration");
      setupConfig = await this.promptProjectSetup();
      this.logger.detail(
        "📋 Project config received: " + JSON.stringify(setupConfig)
      );

      // Track command usage and initialization start
      this.logger.detail("📊 Tracking telemetry events");
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
      this.logger.detail("📊 Telemetry events sent");

      // Step 2: Create project structure
      this.logger.detail("🏗️ Step 2: Creating project structure");
      await this.createProject(setupConfig);
      this.logger.detail("🏗️ Project structure created successfully");

      // Step 3: Install Polkadot library
      this.logger.detail("🔗 Step 3: Installing Polkadot library");
      await this.installPolkadotLibrary(setupConfig);
      this.logger.detail("🔗 Polkadot library installed successfully");

      // Step 4: Initialize shadcn/ui
      this.logger.detail("🎨 Step 4: Initializing shadcn/ui");
      await this.initializeShadcn(setupConfig);
      this.logger.detail("🎨 shadcn/ui initialized successfully");

      // Step 5: Success feedback
      this.logger.detail(
        "🎉 Step 5: Showing success message, context: " + this.context
      );
      this.showSuccessMessage(setupConfig);

      // Track successful initialization
      this.logger.detail("📊 Tracking completion telemetry");
      const duration = Date.now() - startTime;
      await this.telemetry.trackProjectInitCompleted(setupConfig.framework, {
        has_typescript: setupConfig.useTypeScript,
        has_tailwind: setupConfig.useTailwind,
        package_manager: await this.projectDetector.detectPackageManager(),
        duration_ms: duration,
      });
      this.logger.detail(
        "✅ InitCommand.execute() - Completed successfully in " +
          duration +
          "ms"
      );
    } catch (error) {
      this.logger.detail(
        "❌ InitCommand.execute() - Error caught in main try/catch: " +
          (error instanceof Error ? error.message : String(error))
      );
      await this.handleInitializationError(error, setupConfig, startTime);
    }
  }

  /**
   * Project setup prompts - always ask essential questions
   */
  private async promptProjectSetup(): Promise<ProjectSetupConfig> {
    this.logger.detail("🔧 promptProjectSetup() - Starting project setup");
    const currentDir = path.basename(process.cwd());
    this.logger.detail("📁 Current directory: " + currentDir);
    this.logger.detail(
      "⚙️ Options: " +
        JSON.stringify({
          verbose: this.options.verbose,
          dev: this.options.dev,
          interactive: this.options.interactive,
        })
    );

    // Always ask essential questions:
    // 1. Framework choice (Next.js vs Vite)
    // 2. Polkadot library choice (papi vs dedot)
    // --interactive flag only controls create-next-app and shadcn verbosity
    this.logger.detail("💬 Running essential setup prompts");
    this.logger.info("Setting up project with essential prompts...");
    this.logger.detail("Framework choice and Polkadot library selection");
    this.logger.detail(
      "Use --interactive for detailed create-next-app/shadcn prompts"
    );
    return await this.runEssentialSetup(currentDir);
  }

  /**
   * Run essential setup prompts (framework + polkadot library)
   */
  private async runEssentialSetup(
    currentDir: string
  ): Promise<ProjectSetupConfig> {
    this.logger.detail(
      "💬 [DEBUG] runEssentialSetup() - Starting essential prompts for:" +
        currentDir
    );

    this.logger.detail(
      "❓ [DEBUG] Prompting user for essential configuration..."
    );
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
    ]);

    this.logger.detail(
      "📋 [DEBUG] User answers received:" + JSON.stringify(answers)
    );

    // Handle Polkadot library selection using the shared utility
    this.logger.detail(
      "🔗 [DEBUG] Prompting for Polkadot library selection..."
    );
    const polkadotDetector = new PolkadotDetector();
    const polkadotLibrary = await polkadotDetector.promptForLibrarySelection({
      skipPrompt: false, // Init command always prompts
      defaultLibrary: "papi",
    });
    this.logger.detail(
      "🔗 [DEBUG] Selected Polkadot library:" + polkadotLibrary
    );

    const finalConfig = {
      projectName: answers.projectName,
      framework: answers.framework,
      useTypeScript: true, // Always enabled for better DX
      useESLint: true, // Always enabled for code quality
      useTailwind: true, // Always enabled for styling
      useSrcDirectory: false, // Default: no src directory
      useAppRouter: true, // Default: use App Router (recommended)
      useTurbopack: false, // Default: no Turbopack
      importAlias: "@/*", // Default: standard alias
      polkadotLibrary: polkadotLibrary,
    };

    this.logger.detail(
      "📋 [DEBUG] Final essential config:" + JSON.stringify(finalConfig)
    );
    return finalConfig;
  }

  /**
   * Create a new project based on user configuration
   */
  private async createProject(config: ProjectSetupConfig): Promise<void> {
    this.logger.detail(
      "🏗️ [DEBUG] createProject() - Starting project creation"
    );
    this.logger.detail("📋 [DEBUG] Project config:" + JSON.stringify(config));

    const spinner = ora(`Creating ${config.framework} project...`).start();

    try {
      if (config.framework === "nextjs") {
        this.logger.detail("⚛️ [DEBUG] Creating Next.js project...");
        await this.createNextJsProject(config);
        this.logger.detail("⚛️ [DEBUG] Next.js project creation completed");
      } else {
        this.logger.detail("⚡ [DEBUG] Creating Vite project...");
        await this.createViteProject(config);
        this.logger.detail("⚡ [DEBUG] Vite project creation completed");
      }

      spinner.succeed(`${config.framework} project created successfully`);
      this.logger.detail(`Project "${config.projectName}" initialized`);
      this.logger.detail(
        "✅ [DEBUG] createProject() - Project creation successful"
      );
    } catch (error) {
      spinner.fail("Failed to create project");
      this.logger.detail(
        "❌ [DEBUG] createProject() - Project creation failed:" + error
      );
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
    this.logger.detail(
      "⚛️ [DEBUG] createNextJsProject() - Building Next.js arguments"
    );
    const args = this.buildNextJsArgs(config);
    this.logger.detail("📦 [DEBUG] Next.js CLI args:" + JSON.stringify(args));

    this.logger.detail("🔧 [DEBUG] Getting package manager command");
    const { executable, baseArgs } = await this.getPackageManagerCommand();
    this.logger.detail(
      "📦 [DEBUG] Package manager:" + JSON.stringify({ executable, baseArgs })
    );

    const fullCommand = [executable, ...baseArgs, ...args];
    this.logger.detail("🚀 [DEBUG] Executing command:" + fullCommand.join(" "));

    await execa(executable, [...baseArgs, ...args], {
      stdio: "pipe", // Hide verbose output but show errors
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        // Disable telemetry for faster creation
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });

    this.logger.detail(
      "✅ [DEBUG] createNextJsProject() - Next.js project created successfully"
    );
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
    if (!this.options.interactive) {
      // Fast mode: use react-ts template directly
      await execa(
        executable,
        [...baseArgs, "create-vite@latest", ".", "--template", "react-ts"],
        {
          stdio: "pipe",
          timeout: 300000,
        }
      );
    } else {
      // Interactive mode: show prompts
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
      this.logger.warning("Failed to update tsconfig.json for import alias");
      this.logger.detail("You may need to configure import paths manually");
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
      this.logger.warning("Failed to update CSS file for Tailwind CSS");
      this.logger.detail("You may need to add Tailwind imports manually");
    }
  }

  /**
   * Initialize shadcn/ui in the project
   */
  private async initializeShadcn(config: ProjectSetupConfig): Promise<void> {
    this.logger.detail(
      "🎨 [DEBUG] initializeShadcn() - Starting shadcn/ui initialization"
    );
    this.logger.detail(
      "⚙️ [DEBUG] Config for shadcn:" +
        JSON.stringify({
          useSrcDirectory: config.useSrcDirectory,
          interactive: this.options.interactive,
        })
    );

    const spinner = ora("Initializing shadcn/ui...").start();

    try {
      this.logger.detail(
        "🔧 [DEBUG] Getting package manager command for shadcn..."
      );
      const { executable, baseArgs } = await this.getPackageManagerCommand();
      const shadcnVersion = "shadcn@canary"; // Use canary for Tailwind v4 support
      this.logger.detail("📦 [DEBUG] Using shadcn version:" + shadcnVersion);

      this.logger.detail("🔧 [DEBUG] Building shadcn arguments...");
      const shadcnArgs = this.buildShadcnArgs(config, shadcnVersion);
      this.logger.detail(
        "📦 [DEBUG] Shadcn CLI args:" + JSON.stringify(shadcnArgs)
      );

      const fullCommand = [executable, ...baseArgs, ...shadcnArgs];
      this.logger.detail(
        "🚀 [DEBUG] Executing shadcn command:" + fullCommand.join(" ")
      );

      await execa(executable, [...baseArgs, ...shadcnArgs], {
        stdio: this.options.interactive ? "inherit" : "pipe",
        timeout: 120000, // 2 minutes timeout
      });

      spinner.succeed("shadcn/ui initialized successfully");
      this.logger.detail("UI components system ready");
      this.logger.detail(
        "✅ [DEBUG] initializeShadcn() - shadcn/ui initialization successful"
      );
    } catch (error) {
      spinner.fail("Failed to initialize shadcn/ui");
      this.logger.detail(
        "❌ [DEBUG] initializeShadcn() - shadcn/ui initialization failed:" +
          error
      );
      this.logger.warning(
        "You may need to run 'npx shadcn@canary init' manually"
      );
      this.logger.detail("This is required before adding components");

      // Don't throw error - this shouldn't stop the entire initialization
      this.logger.info(
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

    if (!this.options.interactive) {
      // Fast mode: use defaults
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
    this.logger.detail(
      "🔗 [DEBUG] installPolkadotLibrary() - Starting Polkadot library installation"
    );
    const libraryName =
      config.polkadotLibrary === "papi" ? "polkadot-api" : "dedot";
    this.logger.detail(
      "📦 [DEBUG] Installing library:" +
        libraryName +
        "for" +
        config.polkadotLibrary
    );

    const spinner = ora(`Installing ${libraryName}...`).start();

    try {
      this.logger.detail("🔧 [DEBUG] Detecting package manager...");
      const packageManager = await this.projectDetector.detectPackageManager();
      const installCommand = packageManager === "npm" ? "install" : "add";
      this.logger.detail(
        "📦 [DEBUG] Package manager:" +
          packageManager +
          "install command:" +
          installCommand
      );

      if (config.polkadotLibrary === "papi") {
        this.logger.detail("🔗 [DEBUG] Installing PAPI library...");
        await this.installPapiLibrary(packageManager, installCommand);
        spinner.succeed("polkadot-api installed");
        this.logger.detail("✅ [DEBUG] PAPI installation completed");
      } else {
        this.logger.detail("🔗 [DEBUG] Installing Dedot library...");
        await this.installDedotLibrary(packageManager, installCommand);
        spinner.succeed("dedot and @dedot/chaintypes installed");
        this.logger.detail("🔍 [DEBUG] Verifying Dedot installation...");
        await this.verifyDedotInstallation();
        this.logger.detail(
          "✅ [DEBUG] Dedot installation and verification completed"
        );
      }

      this.logger.detail(`${libraryName} ready for blockchain development`);
      this.logger.detail(
        "✅ [DEBUG] installPolkadotLibrary() - Installation successful"
      );
    } catch (error) {
      spinner.fail(`Failed to install ${libraryName}`);
      this.logger.detail(
        "❌ [DEBUG] installPolkadotLibrary() - Installation failed:" + error
      );
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
    this.logger.success("Project initialized successfully!");
    this.logger.newline();

    this.logger.subsection("What's been set up:");
    this.logger.detail(`• ${config.framework} project with TypeScript`, true);
    this.logger.detail(
      `• ${config.polkadotLibrary === "papi" ? "polkadot-api" : "dedot"} for blockchain integration`,
      true
    );
    this.logger.detail("• shadcn/ui for beautiful components", true);
    this.logger.detail("• Tailwind CSS for styling", true);
    this.logger.newline();

    // Only show next steps when running standalone init, not when called from add command
    if (this.context === "standalone") {
      this.logger.subsection("Next steps:");
      this.logger.detail("1. Start development server:", true);
      this.logger.code(
        `${config.framework === "nextjs" ? "npm run dev" : "npm run dev"}`
      );
      this.logger.detail("2. Add Polkadot UI components:", true);
      this.logger.code("polka-ui add block-number");
      this.logger.detail("3. Check out the documentation:", true);
      this.logger.code("https://dot-ui.com/docs");
    } else {
      this.logger.detail(
        "🔄 [DEBUG] Skipping next steps - called from add command"
      );
    }
  }

  /**
   * Handle initialization errors with recovery suggestions
   */
  private async handleInitializationError(
    error: unknown,
    setupConfig?: ProjectSetupConfig,
    startTime?: number
  ): Promise<void> {
    this.logger.detail(
      "💥 [DEBUG] handleInitializationError() - Handling initialization error"
    );
    this.logger.detail("❌ [DEBUG] Error details:" + error);
    this.logger.detail("📋 [DEBUG] Setup config at error:" + setupConfig);
    this.logger.detail(
      "⏱️ [DEBUG] Time elapsed:" +
        (startTime ? Date.now() - startTime : "unknown") +
        "ms"
    );

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    this.logger.detail("📄 [DEBUG] Processed error message:" + errorMessage);

    // Note: Init error tracking not implemented yet
    // Could be added to telemetry interface in the future

    this.logger.error("Project initialization failed");
    this.logger.error(errorMessage);
    this.logger.newline();

    // Provide recovery suggestions based on error type
    this.logger.detail("💡 [DEBUG] Showing recovery suggestions...");
    this.showRecoverySuggestions(error, setupConfig);

    this.logger.detail("🚪 [DEBUG] Exiting process with code 1");
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
      this.logger.subsection("Network timeout detected:");
      this.logger.detail("• Check your internet connection", true);
      this.logger.detail("• Try again with a stable network", true);
      this.logger.detail("• Consider using a different package manager", true);
    } else if (
      errorMessage.includes("permission") ||
      errorMessage.includes("EACCES")
    ) {
      this.logger.subsection("Permission error detected:");
      this.logger.detail(
        "• Ensure you have write permissions in this directory",
        true
      );
      this.logger.detail("• Try running with appropriate permissions", true);
      this.logger.detail("• Check if the directory is writable", true);
    } else if (
      errorMessage.includes("space") ||
      errorMessage.includes("ENOSPC")
    ) {
      this.logger.subsection("Disk space error detected:");
      this.logger.detail("• Free up disk space", true);
      this.logger.detail(
        "• Try creating the project in a different location",
        true
      );
    } else {
      this.logger.subsection("Recovery suggestions:");
      this.logger.detail("• Ensure you have Node.js 16+ installed", true);
      this.logger.detail("• Try clearing package manager cache", true);
      if (setupConfig?.framework === "nextjs") {
        this.logger.detail("• Try: npx create-next-app@latest manually", true);
      } else {
        this.logger.detail("• Try: npm create vite@latest manually", true);
      }
    }
  }
}
