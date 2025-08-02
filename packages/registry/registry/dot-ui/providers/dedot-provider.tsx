"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { type ChainId } from "@/registry/dot-ui/lib/config.dot-ui";
import { dotUiConfig } from "@/registry/dot-ui/lib/config.dot-ui";
import {
  getChainIds,
  getChainConfig,
  isValidChainId,
} from "@/registry/dot-ui/lib/utils.dot-ui";
import { DedotClient, WsProvider } from "dedot";
import {
  type BasePolkadotContextValue,
  type BasePolkadotProviderProps,
} from "@/registry/dot-ui/lib/types.dot-ui";
import {
  type ConfiguredChainApi,
  type CompositeApi,
  type AnyChainApi,
} from "@/registry/dot-ui/lib/types.dedot";

// Dedot-specific context type extending the base
type DedotContextValue = BasePolkadotContextValue<
  ConfiguredChainApi,
  Partial<CompositeApi>,
  ChainId
>;

const DedotContext = createContext<DedotContextValue | undefined>(undefined);

export function PolkadotProvider({
  children,
  defaultChain,
}: BasePolkadotProviderProps<ChainId>) {
  const [currentChain, setCurrentChain] = useState<ChainId>(
    defaultChain || (dotUiConfig.defaultChain as ChainId)
  );
  const [apis, setApis] = useState<Partial<CompositeApi>>({});
  const [clients, setClients] = useState<Map<ChainId, ConfiguredChainApi>>(
    new Map()
  );
  const [loadingStates, setLoadingStates] = useState<Map<ChainId, boolean>>(
    new Map()
  );
  const [errorStates, setErrorStates] = useState<Map<ChainId, string | null>>(
    new Map()
  );

  const initializeChain = useCallback(
    async (chainId: ChainId) => {
      // Don't initialize if already connected
      if (apis[chainId]) return;

      setLoadingStates((prev) => new Map(prev).set(chainId, true));
      setErrorStates((prev) => new Map(prev).set(chainId, null));

      try {
        const chainConfig = getChainConfig(dotUiConfig.chains, chainId);

        // Validate that endpoints array exists and has at least one element
        if (!chainConfig.endpoints || !chainConfig.endpoints[0]) {
          throw new Error(
            `Chain ${chainId} (${chainConfig.displayName}) has no endpoints configured. Please add at least one endpoint to the chain configuration.`
          );
        }

        console.log(`Connecting to ${chainConfig.displayName} using dedot`);

        const provider = new WsProvider(chainConfig.endpoints);
        provider.on("connected", (endpoint: string) => {
          console.log("Connected Endpoint", endpoint);
        });

        await provider.connect();

        const client = await DedotClient.new<AnyChainApi>({
          provider,
          cacheMetadata: true,
        });

        setClients((prev) =>
          new Map(prev).set(chainId, client as ConfiguredChainApi)
        );
        setApis((prev: Partial<CompositeApi>) => ({
          ...prev,
          [chainId]: client as CompositeApi[typeof chainId],
        }));

        console.log(`Successfully connected to ${chainConfig.displayName}`);
      } catch (err) {
        console.error(`Failed to initialize ${chainId}:`, err);
        setErrorStates((prev) =>
          new Map(prev).set(
            chainId,
            err instanceof Error
              ? err.message
              : "Failed to initialize Polkadot API"
          )
        );
      } finally {
        setLoadingStates((prev) => new Map(prev).set(chainId, false));
      }
    },
    [apis, setLoadingStates, setErrorStates, setClients, setApis]
  );

  // Initialize the default chain on mount
  useEffect(() => {
    initializeChain(defaultChain || (dotUiConfig.defaultChain as ChainId));
    console.log("DedotProvider initialized");
  }, [defaultChain, initializeChain]);

  const setApi = (chainId: ChainId) => {
    if (!isValidChainId(dotUiConfig.chains, chainId)) {
      console.error(`Invalid chain ID: ${chainId}`);
      return;
    }

    setCurrentChain(chainId);
    // Initialize the chain if not already connected
    if (!apis[chainId]) {
      initializeChain(chainId);
    }
  };

  const disconnect = () => {
    // Handle async disconnect operations properly
    Promise.all(
      Array.from(clients.values()).map(async (client) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error("Error disconnecting client:", error);
        }
      })
    )
      .then(() => {
        console.log("All clients disconnected successfully");
      })
      .catch((error) => {
        console.error("Error during disconnect:", error);
      });

    // Clear state immediately to maintain synchronous interface
    setClients(new Map());
    setApis({});
    setLoadingStates(new Map());
    setErrorStates(new Map());
    setCurrentChain(defaultChain || (dotUiConfig.defaultChain as ChainId));
  };

  const isConnected = (chainId: ChainId): boolean => {
    return !!apis[chainId];
  };

  const isLoading = (chainId: ChainId): boolean => {
    return loadingStates.get(chainId) || false;
  };

  const currentChainConfig = getChainConfig(dotUiConfig.chains, currentChain);

  const value: DedotContextValue = {
    currentChain,
    api: apis[currentChain] as ConfiguredChainApi | null,
    error: errorStates.get(currentChain) || null,
    apis,
    setApi,
    disconnect,
    isConnected,
    isLoading,
    initializeChain,
    chainName: currentChainConfig.displayName,
    availableChains: getChainIds(dotUiConfig.chains),
  };

  return (
    <DedotContext.Provider value={value}>{children}</DedotContext.Provider>
  );
}

export function useDedot(): DedotContextValue {
  const context = useContext(DedotContext);
  if (!context) {
    throw new Error("useDedot must be used within a DedotProvider");
  }
  return context;
}

// Helper to get properly typed API (maintains backward compatibility)
export function useTypedPolkadotApi(): ConfiguredChainApi | null {
  const { api } = useDedot();
  return api;
}

// Helper to get a specific chain's API (type-safe) - similar to papi-provider
export function usePolkadotApi(chainId: ChainId): ConfiguredChainApi | null {
  const { apis, initializeChain } = useDedot();

  // Auto-initialize the chain if not connected
  useEffect(() => {
    if (!apis[chainId]) {
      initializeChain(chainId);
    }
  }, [chainId, apis, initializeChain]);

  return (apis[chainId] as ConfiguredChainApi) || null;
}