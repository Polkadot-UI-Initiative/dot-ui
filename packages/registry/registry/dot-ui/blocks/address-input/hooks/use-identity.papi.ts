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

export interface PolkadotIdentity {
  display?: string;
  legal?: string;
  email?: string;
  twitter?: string;
  verified: boolean;
}

export function usePolkadotIdentity(
  address: string,
  identityChain: ChainId = "paseo_people"
) {
  const { isLoading, isConnected } = usePapi();
  const peopleApi = usePolkadotApi(identityChain);

  return useQuery({
    queryKey: ["polkadot-identity", address, identityChain],
    queryFn: async (): Promise<PolkadotIdentity | null> => {
      if (
        !peopleApi ||
        !address ||
        isLoading(identityChain) ||
        !isConnected(identityChain)
      ) {
        return null;
      }

      try {
        const identityQuery =
          peopleApi?.query.Identity.IdentityOf.getValue(address);

        const identity = await identityQuery;
        if (!identity) return null;

        // Check identity judgements for determining verified identity
        const hasPositiveJudgement = hasPositiveIdentityJudgement(
          identity.judgements
        );

        return {
          display: extractText(identity.info?.display?.value),
          legal: extractText(identity.info?.legal?.value),
          email: extractText(identity.info?.email?.value),
          twitter: extractText(identity.info?.twitter?.value),
          verified: hasPositiveJudgement || false,
        };
      } catch (error) {
        console.error("Identity lookup failed:", error);
        return null;
      }
    },
    enabled:
      !!peopleApi &&
      !!address &&
      address.length > 0 &&
      isConnected(identityChain),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
