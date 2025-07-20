export interface ProjectStructure {
  isNextJs: boolean;
  isVite: boolean;
  isCRA: boolean;
  hasTypeScript: boolean;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  srcDir: string;
  componentDir: string;
  hookDir: string;
  providerDir: string;
  registryDir: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface PolkadotApiConfig {
  hasExistingConfig: boolean;
  existingChains: string[];
  hasPapi: boolean;
  hasDedot: boolean;
}

export interface ComponentInfo {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: ComponentFile[];
}

export interface ComponentFile {
  path: string;
  content: string;
  type: string;
}

export interface CliOptions {
  dev?: boolean;
  force?: boolean;
  verbose?: boolean;
  interactive?: boolean;
}

export interface ProjectSetupConfig {
  projectName: string;
  framework: "nextjs" | "vite";
  useTypeScript: boolean;
  useESLint: boolean;
  useTailwind: boolean;
  useSrcDirectory: boolean;
  useAppRouter: boolean; // Next.js only
  useTurbopack: boolean; // Next.js only
  importAlias: string;
  polkadotLibrary: "papi" | "dedot";
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SetupSteps {
  validateProject: boolean;
  detectPolkadotApi: boolean;
  installComponent: boolean;
  setupPolkadotApi: boolean;
}

export type ProjectType = "nextjs" | "vite" | "cra" | "unknown";
export type PolkadotLibrary = "papi" | "dedot" | "none";
