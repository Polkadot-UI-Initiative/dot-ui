"use client";

import { createClient, UnsafeApi } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { ChainId, dotUiConfig } from "@/registry/dot-ui/lib/config.dot-ui";
import {
  getChainIds,
  getChainConfig,
  isValidChainId,
} from "@/registry/dot-ui/lib/utils.dot-ui";

interface PolkadotContextValue {
  // Current active chain and its API
  currentChain: ChainId;
  api: UnsafeApi<ChainId> | null;
  isLoading: (chainId: ChainId) => boolean;
  error: string | null;

  // All APIs for all registered chains
  apis: Partial<Record<ChainId, UnsafeApi<ChainId>>>;

  // Function to switch active chain (type-safe)
  setApi: (chainId: ChainId) => void;

  // Connection management
  disconnect: () => void;
  isConnected: (chainId: ChainId) => boolean;
  initializeChain: (chainId: ChainId) => Promise<void>;

  // Chain information
  chainName: string | null;
  availableChains: ChainId[];
}

const PolkadotContext = createContext<PolkadotContextValue | undefined>(
  undefined
);

interface PolkadotProviderProps {
  children: React.ReactNode;
  defaultChain?: ChainId;
}

export function PolkadotProvider({
  children,
  defaultChain,
}: PolkadotProviderProps) {
  const [currentChain, setCurrentChain] = useState<ChainId>(
    defaultChain || dotUiConfig.defaultChain
  );
  const [apis, setApis] = useState<
    Partial<Record<ChainId, UnsafeApi<ChainId>>>
  >({});
  const [clients, setClients] = useState<
    Map<ChainId, ReturnType<typeof createClient>>
  >(new Map());
  const [loadingStates, setLoadingStates] = useState<Map<ChainId, boolean>>(
    new Map()
  );
  const [errorStates, setErrorStates] = useState<Map<ChainId, string | null>>(
    new Map()
  );

  // Initialize the default chain on mount
  useEffect(() => {
    initializeChain(defaultChain || dotUiConfig.defaultChain);
  }, [defaultChain]);

  const initializeChain = useCallback(
    async (chainId: ChainId) => {
      // Don't initialize if already connected
      if (apis[chainId]) {
        console.log(`Already connected to ${chainId}`);
        return;
      }

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

        const endpoint = chainConfig.endpoints[0];
        console.log(`Connecting to ${chainConfig.displayName} at ${endpoint}`);

        // Create client with the selected chain
        const client = createClient(
          withPolkadotSdkCompat(getWsProvider(endpoint))
        );

        // Get typed API for the selected chain
        // const typedApi = client.getTypedApi(
        //   polkadotConfig.chains[chainId].descriptor
        // ) as ConfiguredChainApi<typeof chainId>;

        const unsafeApi = client.getUnsafeApi<typeof chainId>();

        setClients((prev) => new Map(prev).set(chainId, client));
        setApis((prev) => ({
          ...prev,
          [chainId]: unsafeApi,
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
    clients.forEach((client) => client.destroy());
    setClients(new Map());
    setApis({});
    setLoadingStates(new Map());
    setErrorStates(new Map());
    setCurrentChain(defaultChain || dotUiConfig.defaultChain);
  };

  const isConnected = (chainId: ChainId): boolean => {
    return !!apis[chainId];
  };

  const isLoading = (chainId: ChainId): boolean => {
    return loadingStates.get(chainId) || false;
  };

  const currentChainConfig = getChainConfig(dotUiConfig.chains, currentChain);

  const value: PolkadotContextValue = {
    currentChain,
    api: apis[currentChain] || null,
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
    <PolkadotContext.Provider value={value}>
      {children}
    </PolkadotContext.Provider>
  );
}

export function usePapi(): PolkadotContextValue {
  const context = useContext(PolkadotContext);

  if (context === undefined) {
    throw new Error("usePapi must be used within a PolkadotProvider");
  }

  return context;
}

// Helper to get properly typed API (maintains backward compatibility)
export function useTypedPolkadotApi(): UnsafeApi<ChainId> | null {
  const { api } = usePapi();
  return api;
}

// Helper to get a specific chain's API (type-safe)
export function usePolkadotApi<T extends ChainId>(
  chainId: T
): UnsafeApi<T> | null {
  const { apis, initializeChain } = usePapi();

  // Auto-initialize the chain if not connected
  useEffect(() => {
    if (!apis[chainId]) {
      initializeChain(chainId);
    }
  }, [chainId, apis, initializeChain]);

  return (apis[chainId] as UnsafeApi<T>) || null;
}

// Type exports
export type { ChainId, UnsafeApi };
