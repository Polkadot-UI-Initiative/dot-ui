"use client";

import { useQuery } from "@tanstack/react-query";
import {
  usePapi,
  usePolkadotApi,
} from "@/registry/dot-ui/providers/papi-provider";
import { extractText } from "@/registry/dot-ui/lib/utils.polkadot-ui";

export interface FormattedIdentity {
  display?: string;
  email?: string;
  legal?: string;
  matrix?: string;
  twitter?: string;
  web?: string;
}

export interface IdentitySearchResult {
  address: string;
  identity: FormattedIdentity;
}

export function useIdentityByDisplayName(
  displayName: string | null | undefined
) {
  const IDENTITY_CHAIN = "paseo_people";
  const { isLoading, isConnected } = usePapi();
  const peopleApi = usePolkadotApi(IDENTITY_CHAIN);

  return useQuery({
    queryKey: ["identity-search", displayName, IDENTITY_CHAIN],
    queryFn: async (): Promise<IdentitySearchResult[]> => {
      if (
        !peopleApi ||
        !displayName ||
        displayName.length < 3 ||
        isLoading(IDENTITY_CHAIN) ||
        !isConnected(IDENTITY_CHAIN)
      ) {
        return [];
      }

      try {
        // Get all identity entries
        const entries = await peopleApi.query.Identity.IdentityOf.getEntries();

        const matches: IdentitySearchResult[] = [];

        for (const { keyArgs, value } of entries) {
          if (!value || !value.info?.display?.value) continue;

          const display = extractText(value.info.display.value);

          if (
            display &&
            display.toLowerCase().includes(displayName.toLowerCase())
          ) {
            matches.push({
              address: keyArgs[0] as string,
              identity: {
                display,
                email: extractText(value.info?.email?.value),
                legal: extractText(value.info?.legal?.value),
                matrix: extractText(value.info?.matrix?.value),
                twitter: extractText(value.info?.twitter?.value),
                web: extractText(value.info?.web?.value),
              },
            });
          }
        }

        return matches;
      } catch (error) {
        console.error("Identity search failed:", error);
        throw error instanceof Error
          ? error
          : new Error("Identity search failed");
      }
    },
    enabled:
      !!peopleApi &&
      !!displayName &&
      displayName.length > 0 &&
      isConnected(IDENTITY_CHAIN),
    staleTime: 5 * 60 * 1000, // 5 minutes - identities don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes - keep cached longer for search
  });
}
