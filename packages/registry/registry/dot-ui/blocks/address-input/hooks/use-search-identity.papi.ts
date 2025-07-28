"use client";

import { useQuery } from "@tanstack/react-query";
import {
  usePapi,
  usePolkadotApi,
} from "@/registry/dot-ui/providers/papi-provider";
import {
  extractText,
  hasPositiveIdentityJudgement,
} from "@/registry/dot-ui/lib/utils.dot-ui";
import { ChainId } from "@/registry/dot-ui/lib/config.dot-ui";

export interface FormattedIdentity {
  display?: string;
  email?: string;
  legal?: string;
  matrix?: string;
  twitter?: string;
  web?: string;
  verified?: boolean;
}

export interface IdentitySearchResult {
  address: string;
  identity: FormattedIdentity;
}

export function useIdentityByDisplayName(
  displayName: string | null | undefined,
  identityChain: ChainId = "paseo_people"
) {
  const { isLoading, isConnected } = usePapi();
  const peopleApi = usePolkadotApi(identityChain);

  return useQuery({
    queryKey: ["identity-search", displayName, identityChain],
    queryFn: async (): Promise<IdentitySearchResult[]> => {
      if (
        !peopleApi ||
        !displayName ||
        displayName.length < 3 ||
        isLoading(identityChain) ||
        !isConnected(identityChain)
      ) {
        return [];
      }

      try {
        // Get all identity entries
        const entries = await peopleApi.query.Identity.IdentityOf.getEntries();

        const MAX_RESULTS = 10;
        const matches: IdentitySearchResult[] = [];

        for (const { keyArgs, value } of entries) {
          if (!value || !value.info?.display?.value) continue;

          const display = extractText(value.info.display.value);

          if (
            display &&
            display.toLowerCase().includes(displayName.toLowerCase())
          ) {
            const hasPositiveJudgement = hasPositiveIdentityJudgement(
              value.judgements
            );

            // Only include verified identities in search results
            // Remove this if block if we want to show all identities
            if (hasPositiveJudgement) {
              matches.push({
                address: keyArgs[0] as string,
                identity: {
                  display,
                  email: extractText(value.info?.email?.value),
                  legal: extractText(value.info?.legal?.value),
                  matrix: extractText(value.info?.matrix?.value),
                  twitter: extractText(value.info?.twitter?.value),
                  web: extractText(value.info?.web?.value),
                  verified: true,
                },
              });

              if (matches.length >= MAX_RESULTS) {
                break;
              }
            }
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
      displayName.length >= 3 &&
      isConnected(identityChain),
    staleTime: 5 * 60 * 1000, // 5 minutes - identities don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes - keep cached longer for search
  });
}
