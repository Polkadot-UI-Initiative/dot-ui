import { PostHog } from "posthog-node";
import type { CliOptions } from "../types/index.js";

interface BaseEventProperties {
  cli_version: string;
  framework?: "nextjs" | "vite";
  has_typescript?: boolean;
  has_tailwind?: boolean;
  package_manager?: "npm" | "yarn" | "pnpm" | "bun";
  polkadot_library?: "papi" | "dedot" | "unknown";
  component_name?: string;
  registry_type?: "papi" | "dedot";
  duration_ms?: number;
  error_message?: string;
  project_type?: string;
  node_version?: string;
  os_platform?: string;
  command?: "add" | "init" | "list";
  detected_library?: "papi" | "dedot" | "none";
  selected_library?: "papi" | "dedot";
  was_prompted?: boolean;
}

export class Telemetry {
  private static readonly POSTHOG_API_KEY =
    "phc_EqCg3vk7Pr5qqshg6YbHBM3ghYZPkc8IDLzhjqLtJwf";
  private static readonly POSTHOG_HOST = "https://eu.i.posthog.com";
  private postHog: PostHog | null = null;

  constructor(private options: CliOptions) {
    this.initializePostHog();
  }

  /**
   * Initialize PostHog client
   */
  private initializePostHog(): void {
    // Skip telemetry in dev mode or if explicitly disabled
    if (process.env.DOT_UI_DISABLE_TELEMETRY === "true") {
      return;
    }

    try {
      this.postHog = new PostHog(Telemetry.POSTHOG_API_KEY, {
        host: Telemetry.POSTHOG_HOST,
        flushAt: 1, // Send events immediately for CLI usage
        flushInterval: 0, // Disable batching
      });
    } catch (error) {
      console.debug("Failed to initialize PostHog:", error);
    }
  }

  /**
   * Get CLI version from package.json
   */
  private async getCliVersion(): Promise<string> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const { fileURLToPath } = await import("url");

      // Get the directory of this module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Read package.json from the CLI package root
      const packageJsonPath = path.join(__dirname, "../../package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      return packageJson.version || "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Get system information for telemetry
   */
  private async getSystemInfo(): Promise<Partial<BaseEventProperties>> {
    try {
      const os = await import("os");

      return {
        node_version: process.version,
        os_platform: os.platform(),
      };
    } catch {
      return {};
    }
  }

  /**
   * Generate a unique user ID based on machine characteristics
   */
  private async getUserId(): Promise<string> {
    try {
      const crypto = await import("crypto");
      const os = await import("os");

      // Create a hash based on hostname and user info
      const identifier = `${os.hostname()}-${os.userInfo().username}`;
      return crypto.createHash("sha256").update(identifier).digest("hex");
    } catch {
      // Fallback to random ID
      return Math.random().toString(36).substring(7);
    }
  }

  /**
   * Send event to PostHog using the official client
   */
  private async sendToPostHog(
    event: string,
    properties: BaseEventProperties
  ): Promise<void> {
    // Skip telemetry in dev mode or if explicitly disabled
    if (process.env.DOT_UI_DISABLE_TELEMETRY === "true" || !this.postHog) {
      return;
    }

    try {
      const userId = await this.getUserId();
      const systemInfo = await this.getSystemInfo();

      // Capture event with PostHog client
      this.postHog.capture({
        distinctId: userId,
        event,
        properties: {
          ...properties,
          ...systemInfo,
          $lib: "dot-ui-cli",
          $lib_version: properties.cli_version,
        },
      });

      // Ensure events are sent immediately for CLI usage
      await this.postHog.flush();
    } catch (error) {
      // Silently fail - telemetry should never break the CLI
      console.debug(
        "PostHog telemetry error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Cleanup PostHog client
   */
  async shutdown(): Promise<void> {
    if (this.postHog) {
      await this.postHog.shutdown();
    }
  }

  /**
   * Track when user starts adding a component
   */
  async trackComponentAddStarted(
    componentName: string,
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Component Add Started", {
      cli_version: await this.getCliVersion(),
      component_name: componentName,
      ...properties,
    });
  }

  /**
   * Track successful component addition
   */
  async trackComponentAddCompleted(
    componentName: string,
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Component Add Completed", {
      cli_version: await this.getCliVersion(),
      component_name: componentName,
      ...properties,
    });
  }

  /**
   * Track component addition failure
   */
  async trackComponentAddFailed(
    componentName: string,
    errorMessage: string,
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Component Add Failed", {
      cli_version: await this.getCliVersion(),
      component_name: componentName,
      error_message: errorMessage.substring(0, 200), // Truncate error messages
      ...properties,
    });
  }

  /**
   * Track project initialization start
   */
  async trackProjectInitStarted(
    framework: "nextjs" | "vite",
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Project Init Started", {
      cli_version: await this.getCliVersion(),
      framework,
      ...properties,
    });
  }

  /**
   * Track successful project initialization
   */
  async trackProjectInitCompleted(
    framework: "nextjs" | "vite",
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Project Init Completed", {
      cli_version: await this.getCliVersion(),
      framework,
      ...properties,
    });
  }

  /**
   * Track project initialization failure
   */
  async trackProjectInitFailed(
    framework: "nextjs" | "vite",
    errorMessage: string,
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Project Init Failed", {
      cli_version: await this.getCliVersion(),
      framework,
      error_message: errorMessage.substring(0, 200),
      ...properties,
    });
  }

  /**
   * Track CLI command usage
   */
  async trackCommandUsed(
    command: "add" | "init" | "list",
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("CLI Command Used", {
      cli_version: await this.getCliVersion(),
      command,
      ...properties,
    });
  }

  /**
   * Track library detection and selection
   */
  async trackLibraryDetected(
    detectedLibrary: "papi" | "dedot" | "none",
    selectedLibrary: "papi" | "dedot",
    wasPrompted: boolean,
    properties: Partial<BaseEventProperties> = {}
  ): Promise<void> {
    await this.sendToPostHog("Polkadot Library Detected", {
      cli_version: await this.getCliVersion(),
      detected_library: detectedLibrary,
      selected_library: selectedLibrary,
      was_prompted: wasPrompted,
      ...properties,
    });
  }
}
