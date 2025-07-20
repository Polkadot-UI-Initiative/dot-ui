import type { ChainConfig } from "@/registry/dot-ui/lib/types.polkadot-ui";
import { decodeAddress, encodeAddress } from "@polkadot/keyring";
import { ethers } from "ethers";

// Generic helper functions that work with any polkadot config
export function getChainIds<T extends Record<string, ChainConfig>>(
  chains: T
): (keyof T)[] {
  return Object.keys(chains) as (keyof T)[];
}

export function getChainConfig<
  T extends Record<string, ChainConfig>,
  K extends keyof T,
>(chains: T, chainId: K): T[K] {
  return chains[chainId];
}

export function isValidChainId<T extends Record<string, ChainConfig>>(
  chains: T,
  chainId: string
): chainId is string & keyof T {
  return chainId in chains;
}

// Helper function to safely extract text from papi encoded types
export const extractText = (value: unknown): string | undefined => {
  // Check if value exists
  if (!value) return undefined;

  // If it's already a string, return it
  if (typeof value === "string") return value;

  // Check if it has asText method at runtime (PAPI encoded types)
  if (value && typeof value === "object" && "asText" in value) {
    try {
      const textMethod = (value as Record<string, unknown>).asText;
      if (typeof textMethod === "function") {
        return textMethod.call(value) as string;
      }
    } catch (error) {
      console.warn("Failed to call asText method:", error);
    }
  }

  // Check if it has a text property (some PAPI types)
  if (value && typeof value === "object" && "text" in value) {
    const textValue = (value as Record<string, unknown>).text;
    if (typeof textValue === "string") return textValue;
  }

  // Fallback to toString for other types
  try {
    return String(value);
  } catch {
    return undefined;
  }
};

export interface ValidationResult {
  isValid: boolean;
  type: "ss58" | "eth" | "unknown";
  error?: string;
  normalizedAddress?: string;
}

export function validateAddress(
  address: string,
  format: "eth" | "ss58" | "both"
): ValidationResult {
  if (!address.trim()) {
    return { isValid: false, type: "unknown", error: "Address is required" };
  }

  // SS58 validation
  if (format === "ss58" || format === "both") {
    try {
      const decoded = decodeAddress(address);

      // Check if the decoded address has the proper length (32 bytes for a public key)
      if (decoded.length !== 32) {
        throw new Error("Invalid address length");
      }

      const encoded = encodeAddress(decoded, 42); // Polkadot prefix
      return {
        isValid: true,
        type: "ss58",
        normalizedAddress: encoded,
      };
    } catch {
      if (format === "ss58") {
        return {
          isValid: false,
          type: "unknown",
          error: "Invalid Polkadot address format",
        };
      }
    }
  }

  // Ethereum validation
  if (format === "eth" || format === "both") {
    try {
      const normalized = ethers.getAddress(address);
      return {
        isValid: true,
        type: "eth",
        normalizedAddress: normalized,
      };
    } catch {
      if (format === "eth") {
        return {
          isValid: false,
          type: "unknown",
          error: "Invalid Ethereum address format",
        };
      }
    }
  }

  return {
    isValid: false,
    type: "unknown",
    error: "Invalid address format",
  };
}

export function truncateAddress(
  address: string,
  length: number | boolean = 8
): string {
  if (!address || length === false) return address;

  const truncLength = typeof length === "number" ? length : 8;

  if (address.length <= truncLength * 2 + 3) return address;

  return `${address.slice(0, truncLength)}...${address.slice(-truncLength)}`;
}
