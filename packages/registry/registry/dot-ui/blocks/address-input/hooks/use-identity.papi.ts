import { useQuery } from "@tanstack/react-query";
import {
  usePapi,
  usePolkadotApi,
} from "@/registry/dot-ui/providers/papi-provider";
import { extractText } from "@/registry/dot-ui/lib/utils.polkadot-ui";

export interface PolkadotIdentity {
  display?: string;
  legal?: string;
  email?: string;
  twitter?: string;
  verified: boolean;
}

export function usePolkadotIdentity(address: string) {
  const IDENTITY_CHAIN = "paseo_people";
  const { isLoading, isConnected } = usePapi();
  const peopleApi = usePolkadotApi(IDENTITY_CHAIN);

  return useQuery({
    queryKey: ["polkadot-identity", address, IDENTITY_CHAIN],
    queryFn: async (): Promise<PolkadotIdentity | null> => {
      if (
        !peopleApi ||
        !address ||
        isLoading(IDENTITY_CHAIN) ||
        !isConnected(IDENTITY_CHAIN)
      ) {
        return null;
      }

      try {
        const identityQuery =
          peopleApi?.query.Identity.IdentityOf.getValue(address);

        const identity = await identityQuery;
        if (!identity) return null;

        return {
          display: extractText(identity.info?.display?.value),
          legal: extractText(identity.info?.legal?.value),
          email: extractText(identity.info?.email?.value),
          twitter: extractText(identity.info?.twitter?.value),
          verified: false, // TODO: Implement proper judgement verification
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
      isConnected(IDENTITY_CHAIN),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
