import { decodeAddress, encodeAddress } from "@polkadot/keyring";
import { ethers } from "ethers";

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
