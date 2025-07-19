import { DotUiConfig, SubstrateExplorer } from "./types.polkadot-ui";

export const dotUiConfig: DotUiConfig = {
  chains: {
    paseo_asset_hub: {
      endpoints: [
        "wss://sys.ibp.network/asset-hub-paseo",
        "wss://asset-hub-paseo.dotters.network",
      ],
      displayName: "Paseo Asset Hub",
      explorerUrls: {
        [SubstrateExplorer.PolkadotJs]: `https://polkadot.js.org/apps/?rpc=${encodeURIComponent("wss://sys.ibp.network/asset-hub-paseo")}#/explorer`,
      },
      isTestnet: true,
    },
    paseo: {
      endpoints: ["wss://sys.ibp.network/paseo", "wss://paseo.dotters.network"],
      displayName: "Paseo Relay Chain",
      explorerUrls: {
        [SubstrateExplorer.PolkadotJs]: `https://polkadot.js.org/apps/?rpc=${encodeURIComponent("wss://sys.ibp.network/paseo")}#/explorer`,
      },
      isTestnet: true,
    },
    paseo_people: {
      endpoints: ["wss://sys.ibp.network/people-paseo"],
      displayName: "Paseo People",
      explorerUrls: {
        [SubstrateExplorer.PolkadotJs]: `https://polkadot.js.org/apps/?rpc=${encodeURIComponent("wss://sys.ibp.network/people-paseo")}#/explorer`,
      },
      isTestnet: true,
    },
  },
  defaultChain: "paseo_asset_hub",
};

// Simple type aliases for type safety
export type ChainId = keyof typeof dotUiConfig.chains;
export type ChainConfig<T extends ChainId> = (typeof dotUiConfig.chains)[T];
