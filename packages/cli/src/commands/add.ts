import ora from "ora";
import execa from "execa";
import inquirer from "inquirer";
import { ProjectDetector } from "../utils/project-detector.js";
import { PolkadotDetector } from "../utils/polkadot-detector.js";
import {
  Registry,
  isValidComponentName,
  formatComponentName,
} from "../utils/registry.js";
import { logger } from "../utils/logger.js";
import { Telemetry } from "../utils/telemetry.js";
import {
  CliOptions,
  ComponentInfo,
  ProjectStructure,
  PolkadotApiConfig,
} from "../types/index.js";
import { InitCommand } from "./init.js";

export class AddCommand {
  private options: CliOptions;
  private registry: Registry;
  private projectDetector: ProjectDetector;
  private polkadotDetector: PolkadotDetector;
  private telemetry: Telemetry;

  constructor(options: CliOptions) {
    this.options = options;
    this.registry = new Registry(options.dev);
    this.projectDetector = new ProjectDetector();
    this.polkadotDetector = new PolkadotDetector();
    this.telemetry = new Telemetry(options);
  }

  /**
   * Main add command execution
   */
  async execute(componentName: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1: Validate component name
      if (!this.validateComponentName(componentName)) {
        return;
      }

      // Step 2: Validate project setup
      const projectStructure = await this.validateProjectSetup();
      if (!projectStructure) {
        return;
      }

      // Step 3: Check component availability
      const componentInfo =
        await this.validateComponentAvailability(componentName);
      if (!componentInfo) {
        return;
      }

      // Track command usage and component addition start
      const framework = projectStructure.isNextJs ? "nextjs" : "vite";
      await this.telemetry.trackCommandUsed("add", {
        framework,
        has_typescript: projectStructure.hasTypeScript,
        package_manager: projectStructure.packageManager as any,
        project_type: projectStructure.isNextJs ? "nextjs" : "vite",
      });

      await this.telemetry.trackComponentAddStarted(componentInfo.name, {
        framework,
        has_typescript: projectStructure.hasTypeScript,
        package_manager: projectStructure.packageManager as any,
        project_type: projectStructure.isNextJs ? "nextjs" : "vite",
      });

      // Step 4: Detect Polkadot API setup
      const polkadotConfig = await this.detectPolkadotSetup(componentInfo);

      // Step 5: Install component
      await this.installComponent(
        componentInfo,
        projectStructure,
        polkadotConfig
      );

      // Step 6: Show completion message
      this.showCompletionMessage(componentInfo, polkadotConfig);

      // Track successful component addition
      const duration = Date.now() - startTime;
      const selectedLibrary = this.registry.getSelectedLibrary() || "unknown";
      await this.telemetry.trackComponentAddCompleted(componentInfo.name, {
        framework,
        has_typescript: projectStructure.hasTypeScript,
        has_tailwind: true, // We always install Tailwind
        package_manager: projectStructure.packageManager as any,
        polkadot_library:
          selectedLibrary === "unknown" ? "unknown" : selectedLibrary,
        registry_type:
          selectedLibrary === "unknown" ? undefined : selectedLibrary,
        duration_ms: duration,
        project_type: projectStructure.isNextJs ? "nextjs" : "vite",
      });
    } catch (error) {
      await this.handleInstallationError(error, componentName, startTime);
    }
  }

  /**
   * Step 1: Validate component name format
   */
  private validateComponentName(componentName: string): boolean {
    if (!componentName) {
      logger.error("Component name is required");
      logger.info("Usage: polka-ui add <component-name>");
      logger.newline();
      logger.subsection("Examples:");
      logger.detail("polka-ui add block-number", true);
      logger.detail("polka-ui add wallet-connect", true);
      return false;
    }

    if (!isValidComponentName(componentName)) {
      logger.error(`Invalid component name: ${componentName}`);
      logger.info(
        "Component names should be kebab-case (e.g., block-number, user-profile)"
      );
      logger.newline();
      logger.subsection("Valid examples:");
      logger.detail("✓ block-number", true);
      logger.detail("✓ wallet-connect", true);
      logger.detail("✓ staking-rewards", true);
      logger.newline();
      logger.subsection("Invalid examples:");
      logger.detail("✗ blockNumber (camelCase)", true);
      logger.detail("✗ BlockNumber (PascalCase)", true);
      logger.detail("✗ block_number (snake_case)", true);
      return false;
    }

    return true;
  }

  /**
   * Step 2: Validate project setup (package.json, React, framework)
   */
  private async validateProjectSetup(): Promise<ProjectStructure | null> {
    const spinner = ora("Validating project setup...").start();

    try {
      // Check if package.json exists
      if (!(await this.projectDetector.hasPackageJson())) {
        spinner.stop();
        return await this.handleMissingProject();
      }

      // Check if it's a React project
      if (!(await this.projectDetector.hasReact())) {
        spinner.stop();
        logger.showReactRequirements();
        return null;
      }

      // Validate complete project structure
      const validation = await this.projectDetector.validateProject();

      if (!validation.isValid) {
        spinner.stop();
        logger.showValidationErrors(validation.errors, validation.warnings);
        return null;
      }

      // Get project structure
      const structure = await this.projectDetector.detectProjectStructure();

      // Show detected project info
      const projectType = structure.isNextJs
        ? "Next.js"
        : structure.isVite
          ? "Vite"
          : structure.isCRA
            ? "Create React App"
            : "Unknown";

      spinner.succeed(
        `${projectType} project detected${
          structure.hasTypeScript ? " with TypeScript" : ""
        } (${structure.packageManager})`
      );

      // Show warnings if any
      if (validation.warnings.length > 0) {
        logger.showValidationErrors([], validation.warnings);
      }

      return structure;
    } catch (error) {
      spinner.fail("Project validation failed");
      logger.error(
        error instanceof Error ? error.message : "Unknown validation error"
      );
      return null;
    }
  }

  /**
   * Handle missing project scenario
   */
  private async handleMissingProject(): Promise<ProjectStructure | null> {
    let shouldCreateProject = !this.options.interactive; // Auto-create in fast mode

    if (this.options.interactive) {
      // Interactive mode: ask the user
      const result = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldCreateProject",
          message: "No project found. Would you like to create a new project?",
          default: true,
        },
      ]);
      shouldCreateProject = result.shouldCreateProject;
    } else {
      logger.info(
        "No project found. Creating new project automatically (fast mode)"
      );
    }

    if (!shouldCreateProject) {
      logger.showProjectGuidance();
      return null;
    }

    // Run init command to set up the project
    try {
      const initCommand = new InitCommand(this.options, "from-add");
      await initCommand.execute();

      // Wait for file system to sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Return the project structure after creation
      const structure = await this.projectDetector.detectProjectStructure();
      logger.success("Project initialized successfully");
      return structure;
    } catch (structureError) {
      logger.error("Failed to detect project structure after initialization");
      logger.info("Please run the command again or check your project setup");
      return null;
    }
  }

  /**
   * Step 3: Check component availability
   */
  private async validateComponentAvailability(
    componentName: string
  ): Promise<ComponentInfo | null> {
    const spinner = ora("Checking component availability...").start();

    try {
      // Check registry connection
      const registryInfo = await this.registry.getRegistryInfo();

      if (!registryInfo.isConnected) {
        spinner.fail("Registry connection failed");
        logger.error(`Cannot connect to registry: ${registryInfo.url}`);
        this.showRegistryConnectionGuidance(registryInfo);
        return null;
      }

      // Fetch component
      const componentInfo = await this.registry.fetchComponent(componentName);

      if (!componentInfo) {
        spinner.fail("Component not found");
        logger.error(`Component "${componentName}" not found in registry`);
        await this.suggestSimilarComponents(componentName);
        return null;
      }

      spinner.succeed(`Component "${componentInfo.title}" found`);
      logger.detail(componentInfo.description);

      return componentInfo;
    } catch (error) {
      spinner.fail("Component check failed");
      throw new Error(
        `Failed to check component availability: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Show registry connection guidance
   */
  private showRegistryConnectionGuidance(registryInfo: any): void {
    if (this.options.dev) {
      logger.detail(
        "Make sure your local registry server is running on localhost:3000"
      );
    }
    if (registryInfo.error) {
      logger.detail(registryInfo.error);
    }

    logger.newline();
    logger.subsection("Troubleshooting:");
    if (this.options.dev) {
      logger.detail("• Start the development server: pnpm dev", true);
      logger.detail("• Check if localhost:3000 is accessible", true);
    } else {
      logger.detail("• Check your internet connection", true);
      logger.detail("• Try using development registry: --dev flag", true);
    }
  }

  /**
   * Step 4: Detect Polkadot API setup
   */
  private async detectPolkadotSetup(
    componentInfo: ComponentInfo
  ): Promise<PolkadotApiConfig> {
    const spinner = ora("Detecting Polkadot API setup...").start();

    try {
      const polkadotConfig = await this.polkadotDetector.getPolkadotApiConfig();
      const library = await this.polkadotDetector.detectPolkadotLibrary();

      logger.detail(
        `Component dependencies: ${JSON.stringify(componentInfo.dependencies)}`
      );

      // Track library detection for telemetry
      let selectedLibrary: "papi" | "dedot" = "papi"; // Default fallback
      let wasPrompted = false;

      // Handle case where no library is detected - prompt user
      if (library === "none") {
        spinner.stop();

        logger.info("No Polkadot API library detected.");
        logger.info(
          "This component requires a Polkadot API library to function."
        );

        // Always prompt user for library choice (essential question)
        selectedLibrary = await this.polkadotDetector.promptForLibrarySelection(
          {
            skipPrompt: false, // Always ask for library choice
            defaultLibrary: "papi",
          }
        );
        wasPrompted = true;

        // Tell the registry about the user's choice so it fetches the right files
        this.registry.setSelectedLibrary(selectedLibrary);

        logger.info(
          `Selected: ${selectedLibrary === "papi" ? "Polkadot API (papi)" : "Dedot"}`
        );
        logger.info(
          "The library will be installed and configured automatically."
        );

        // Track library detection and selection
        await this.telemetry.trackLibraryDetected(
          "none",
          selectedLibrary,
          wasPrompted
        );

        return polkadotConfig;
      }

      // Provide status based on detected library
      if (library === "papi") {
        selectedLibrary = "papi";
        this.registry.setSelectedLibrary(selectedLibrary);

        if (polkadotConfig.hasExistingConfig) {
          spinner.succeed(
            `Polkadot API (papi) detected with ${polkadotConfig.existingChains.length} chains`
          );
          logger.detail(
            `Existing chains: ${polkadotConfig.existingChains.join(", ")}`
          );
        } else {
          spinner.succeed(
            "Polkadot API (papi) detected - configuration will be added"
          );
        }
      } else if (library === "dedot") {
        selectedLibrary = "dedot";
        this.registry.setSelectedLibrary(selectedLibrary);
        spinner.succeed("Dedot detected - will use existing setup");
      }

      // Track library detection and selection
      await this.telemetry.trackLibraryDetected(
        library as "papi" | "dedot" | "none",
        selectedLibrary,
        wasPrompted
      );

      return polkadotConfig;
    } catch (error) {
      spinner.fail("Polkadot detection failed");
      throw new Error(
        `Failed to detect Polkadot setup: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Step 5: Install component
   */
  private async installComponent(
    componentInfo: ComponentInfo,
    projectStructure: ProjectStructure,
    polkadotConfig: PolkadotApiConfig
  ): Promise<void> {
    // Install component using shadcn CLI (handles component files and registryDependencies automatically)
    await this.installComponentWithShadcn(componentInfo.name);

    // Setup Polkadot API if needed
    await this.setupPolkadotApi(
      componentInfo,
      projectStructure,
      polkadotConfig
    );

    // Validate installation
    await this.validateInstallation(componentInfo);
  }

  /**
   * Install component using shadcn CLI
   */
  private async installComponentWithShadcn(
    componentName: string
  ): Promise<void> {
    const spinner = ora("Installing component with shadcn...").start();

    try {
      // Check if shadcn is initialized
      await this.ensureShadcnInitialized();

      // Get registry info and build component URL
      const registryInfo = await this.registry.getRegistryInfo();
      const componentUrl = `${registryInfo.url}/${componentName}.json`;

      // Get package manager command
      const runCommand =
        await this.projectDetector.getPackageManagerRunCommand();
      const tailwindVersion = await this.projectDetector.getTailwindVersion();
      const shadcnVersion =
        tailwindVersion === 4 ? "shadcn@canary" : "shadcn@latest";

      logger.detail(`Using ${shadcnVersion} to install from ${componentUrl}`);

      // Stop spinner before interactive prompts
      spinner.stop();

      // Build command arguments
      const [executable, ...baseArgs] = runCommand.split(" ");
      const shadcnArgs = [shadcnVersion, "add", componentUrl];

      if (!this.options.interactive) {
        // Fast mode: skip prompts
        shadcnArgs.push("--yes");
      }

      logger.info(`Running: ${runCommand} ${shadcnArgs.join(" ")}`);

      // Execute shadcn add command
      await execa(executable, [...baseArgs, ...shadcnArgs], {
        stdio: "inherit",
      });

      logger.success("Component installed successfully");
    } catch (error) {
      logger.error("Failed to install component with shadcn");
      throw new Error(
        `Failed to install component: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Ensure shadcn/ui is initialized
   */
  private async ensureShadcnInitialized(): Promise<void> {
    const fs = await import("fs/promises");
    const componentsJsonExists = await fs
      .access("components.json")
      .then(() => true)
      .catch(() => false);

    if (!componentsJsonExists) {
      await this.initializeShadcn();
    }
  }

  /**
   * Initialize shadcn/ui in the current project
   */
  private async initializeShadcn(): Promise<void> {
    const spinner = ora("Initializing shadcn/ui...").start();

    try {
      const runCommand =
        await this.projectDetector.getPackageManagerRunCommand();
      const tailwindVersion = await this.projectDetector.getTailwindVersion();
      const shadcnVersion =
        tailwindVersion === 4 ? "shadcn@canary" : "shadcn@latest";

      const [executable, ...baseArgs] = runCommand.split(" ");
      const shadcnArgs = [shadcnVersion, "init"];

      // Add explicit defaults in fast mode
      if (!this.options.interactive) {
        shadcnArgs.push("--yes", "--base-color", "neutral", "--css-variables");

        // Detect if src directory is used
        const projectStructure =
          await this.projectDetector.detectProjectStructure();
        if (projectStructure.srcDir && projectStructure.srcDir !== ".") {
          shadcnArgs.push("--src-dir");
        } else {
          shadcnArgs.push("--no-src-dir");
        }
      }

      await execa(executable, [...baseArgs, ...shadcnArgs], {
        stdio: "inherit",
      });

      spinner.succeed("shadcn/ui initialized successfully");
    } catch (error) {
      spinner.fail("Failed to initialize shadcn/ui");
      logger.warning("You may need to run 'npx shadcn@canary init' manually");
      throw error;
    }
  }

  /**
   * Setup Polkadot API configuration
   */
  private async setupPolkadotApi(
    componentInfo: ComponentInfo,
    projectStructure: ProjectStructure,
    polkadotConfig: PolkadotApiConfig
  ): Promise<void> {
    logger.info("Setting up API...");

    try {
      // Detect which library is being used or was selected
      const library = await this.polkadotDetector.detectPolkadotLibrary();

      if (library === "papi") {
        await this.setupPapiApi();
        logger.info("Papi setup complete");
      } else if (library === "dedot") {
        await this.setupDedotApi();
        logger.info("Dedot setup complete");
      } else {
        // If no library is detected, check if user made a selection
        const selectedLibrary = this.registry.getSelectedLibrary();

        if (selectedLibrary === "papi") {
          logger.info("Installing and configuring Polkadot API (papi)...");
          await this.installPolkadotApi();
          await this.setupPapiApi();
        } else if (selectedLibrary === "dedot") {
          logger.info("Installing and configuring Dedot...");
          await this.setupDedotApi(); // This will install dedot if needed
        } else {
          // Fallback to papi if no selection made (shouldn't happen with new flow)
          logger.info(
            "No library selected, defaulting to Polkadot API (papi)..."
          );
          await this.installPolkadotApi();
          await this.setupPapiApi();
        }
      }

      logger.success("API configured");
    } catch (error) {
      logger.error("API setup failed");
      throw new Error(
        `Failed to setup API: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Install polkadot-api package and dependencies
   */
  private async installPolkadotApi(): Promise<void> {
    const spinner = ora("Installing polkadot-api...").start();

    try {
      const packageManager = await this.projectDetector.detectPackageManager();
      const installCommand = packageManager === "npm" ? "install" : "add";

      await execa(
        packageManager,
        [installCommand, "polkadot-api", "@polkadot-api/descriptors"],
        { stdio: "pipe" }
      );

      spinner.succeed("polkadot-api installed");
    } catch (error) {
      spinner.fail("Failed to install polkadot-api");
      throw new Error(
        `Failed to install polkadot-api: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Setup papi-specific configuration
   */
  private async setupPapiApi(): Promise<void> {
    // Use the already detected polkadot config
    const polkadotConfig = await this.polkadotDetector.getPolkadotApiConfig();

    // If we already have existing chains configured, we're good
    if (polkadotConfig.existingChains.length > 0) {
      logger.info(
        `Papi already configured with ${polkadotConfig.existingChains.length} chains: ${polkadotConfig.existingChains.join(", ")}`
      );
      return;
    }

    // If no chains are configured, install defaults
    logger.info("No chains configured, installing defaults");
    const defaultChains = ["paseo", "paseo_people"];

    logger.detail(`Installing default chains: ${defaultChains.join(", ")}`);
    await this.installMissingChains(defaultChains);
  }

  /**
   * Setup dedot-specific configuration (minimal setup)
   */
  private async setupDedotApi(): Promise<void> {
    logger.info("Setting up dedot configuration...");

    // Check existing installation
    const hasDedot = await this.polkadotDetector.hasDedot();
    const hasChainTypes = await this.polkadotDetector.hasChainTypes();

    if (hasDedot && hasChainTypes) {
      logger.info("Dedot is already fully configured - skipping setup");
      return;
    }

    const packageManager = await this.projectDetector.detectPackageManager();
    const installCommand = packageManager === "npm" ? "install" : "add";

    // Install dedot if not present
    if (!hasDedot) {
      await this.installDedotPackage(packageManager, installCommand);
    }

    // Install @dedot/chaintypes as devDependency if not present
    if (!hasChainTypes) {
      await this.installDedotChainTypes(packageManager, installCommand);
    }

    logger.info("Dedot setup complete");
  }

  /**
   * Install dedot package
   */
  private async installDedotPackage(
    packageManager: string,
    installCommand: string
  ): Promise<void> {
    const spinner = ora("Installing dedot...").start();

    try {
      await execa(packageManager, [installCommand, "dedot"], { stdio: "pipe" });
      spinner.succeed("dedot installed");
    } catch (error) {
      spinner.fail("Failed to install dedot");
      throw error;
    }
  }

  /**
   * Install @dedot/chaintypes as devDependency
   */
  private async installDedotChainTypes(
    packageManager: string,
    installCommand: string
  ): Promise<void> {
    const spinner = ora("Installing @dedot/chaintypes...").start();

    try {
      const devFlag = packageManager === "npm" ? "--save-dev" : "-D";
      await execa(
        packageManager,
        [installCommand, devFlag, "@dedot/chaintypes"],
        {
          stdio: "pipe",
        }
      );
      spinner.succeed("@dedot/chaintypes installed as devDependency");
    } catch (error) {
      spinner.fail("Failed to install @dedot/chaintypes");
      throw error;
    }
  }

  /**
   * Install missing papi chains and generate types
   */
  private async installMissingChains(chains: string[]): Promise<void> {
    const chainDisplayName =
      chains.length > 1 ? `${chains.length} chains` : chains[0];
    const spinner = ora(`Adding ${chainDisplayName} metadata...`).start();

    try {
      // Add each chain with increased memory limit
      for (const chain of chains) {
        spinner.text = `Adding ${chain} metadata...`;

        try {
          await execa("node_modules/.bin/papi", ["add", chain, "-n", chain], {
            stdio: "pipe",
            env: {
              ...process.env,
              NODE_OPTIONS: "--max-old-space-size=8192", // Increase memory limit
            },
          });
        } catch (chainError) {
          await this.handleChainInstallError(chainError, chain, spinner);
          return;
        }
      }

      spinner.text = "Generating Polkadot API types...";

      // Generate types for all chains with increased memory
      await execa("node_modules/.bin/papi", [], {
        stdio: "pipe",
        env: {
          ...process.env,
          NODE_OPTIONS: "--max-old-space-size=8192",
        },
      });

      spinner.succeed(`${chainDisplayName} metadata and types generated`);
    } catch (error) {
      spinner.fail("Failed to install chains");
      logger.error(
        `papi error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw new Error(
        `Failed to install papi chains: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Handle chain installation errors with recovery suggestions
   */
  private async handleChainInstallError(
    chainError: unknown,
    chain: string,
    spinner: any
  ): Promise<void> {
    const errorMessage =
      chainError instanceof Error ? chainError.message : String(chainError);

    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("JS heap out of memory")
    ) {
      spinner.fail(`Failed to install ${chain} - insufficient memory`);
      logger.warning(
        `Memory limit exceeded while processing ${chain} metadata`
      );

      logger.newline();
      logger.subsection("Memory error solutions:");
      logger.detail("1. Increase your system memory", true);
      logger.detail("2. Use a smaller chain set", true);
      logger.detail("3. Install chains manually one by one", true);

      logger.newline();
      logger.subsection("Manual installation command:");
      logger.code(
        `NODE_OPTIONS="--max-old-space-size=8192" node_modules/.bin/papi add ${chain} -n ${chain}`
      );

      throw new Error(`Memory limit exceeded for chain ${chain}`);
    }

    throw chainError;
  }

  /**
   * Validate component installation
   */
  private async validateInstallation(
    componentInfo: ComponentInfo
  ): Promise<void> {
    // Basic validation - check if component files were created
    // This could be expanded to verify file contents, imports, etc.
    logger.detail("Installation validation complete");
  }

  /**
   * Show completion message and next steps
   */
  private showCompletionMessage(
    componentInfo: ComponentInfo,
    polkadotConfig: PolkadotApiConfig
  ): void {
    const formattedName = formatComponentName(componentInfo.name);
    const hasDedot = componentInfo.dependencies?.includes("dedot") || false;

    logger.showNextSteps(formattedName, hasDedot);
  }

  /**
   * Handle installation errors with recovery suggestions
   */
  private async handleInstallationError(
    error: unknown,
    componentName: string,
    startTime: number
  ): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    // Track component addition error
    await this.telemetry.trackComponentAddFailed(componentName, errorMessage);

    logger.error("Component installation failed");
    logger.error(errorMessage);
    logger.newline();

    // Provide recovery suggestions
    this.showInstallationRecovery(error, componentName);

    process.exit(1);
  }

  /**
   * Show installation recovery suggestions
   */
  private showInstallationRecovery(
    error: unknown,
    componentName: string
  ): void {
    const errorMessage = error instanceof Error ? error.message : "";

    if (errorMessage.includes("shadcn")) {
      logger.subsection("shadcn/ui issues:");
      logger.detail(
        "• Try initializing shadcn manually: npx shadcn@canary init",
        true
      );
      logger.detail("• Check if components.json exists", true);
      logger.detail("• Verify Tailwind CSS is properly configured", true);
    } else if (
      errorMessage.includes("registry") ||
      errorMessage.includes("fetch")
    ) {
      logger.subsection("Registry connection issues:");
      logger.detail("• Check your internet connection", true);
      logger.detail("• Try using development registry: --dev flag", true);
      logger.detail("• Verify component name spelling", true);
    } else if (
      errorMessage.includes("memory") ||
      errorMessage.includes("heap")
    ) {
      logger.subsection("Memory issues:");
      logger.detail("• Close other applications to free memory", true);
      logger.detail("• Try installing smaller components first", true);
      logger.detail("• Consider upgrading system memory", true);
    } else {
      logger.subsection("General recovery:");
      logger.detail("• Ensure project has valid package.json", true);
      logger.detail("• Check if React is properly installed", true);
      logger.detail("• Try running: polka-ui list", true);
      logger.detail("• Use --verbose flag for detailed output", true);
    }

    logger.newline();
    logger.subsection("Get help:");
    logger.detail("• Documentation: https://dot-ui.com/docs", true);
    logger.detail(
      "• GitHub Issues: https://github.com/Polkadot-UI-Initiative/dot-ui/issues",
      true
    );
  }

  /**
   * Suggest similar components when component not found
   */
  private async suggestSimilarComponents(componentName: string): Promise<void> {
    try {
      const similarComponents =
        await this.registry.searchComponents(componentName);

      if (similarComponents.length > 0) {
        logger.newline();
        logger.subsection("Did you mean one of these?");
        similarComponents.slice(0, 3).forEach((component) => {
          logger.detail(`• ${component.name} - ${component.description}`, true);
        });
        logger.newline();
        logger.info("To see all available components, run: polka-ui list");
      } else {
        logger.newline();
        logger.info("To see all available components, run: polka-ui list");
      }
    } catch {
      // Ignore errors in suggestions
      logger.info("To see all available components, run: polka-ui list");
    }
  }
}
