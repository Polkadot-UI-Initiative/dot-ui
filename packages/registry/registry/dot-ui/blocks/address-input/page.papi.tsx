"use client";

import { polkadotConfig } from "@/registry/dot-ui/lib/config.papi";
import { PolkadotProvider } from "@/registry/dot-ui/providers/papi-provider";
import { AddressInput } from "@/registry/dot-ui/blocks/address-input/components/address-input.papi";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function AddressInputPage() {
  const [address, setAddress] = useState("");
  const [identityResult, setIdentityResult] = useState<{
    type: string;
    data: Record<string, unknown>;
  } | null>(null);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <PolkadotProvider defaultChain={polkadotConfig.defaultChain}>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-bold">AddressInput Component</h1>
            <p className="text-muted-foreground">
              Input component with SS58/Ethereum validation and identity lookup
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Examples</h2>

            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Basic Example */}
              <div className="space-y-2">
                <h3 className="font-medium">Basic Address Input</h3>
                <AddressInput
                  label="Enter Address"
                  placeholder="Enter Polkadot or Ethereum address..."
                  value={address}
                  onChange={setAddress}
                  format="both"
                  onIdentityFound={setIdentityResult}
                />
                {identityResult && (
                  <pre className="text-sm bg-muted p-2 rounded">
                    {JSON.stringify(identityResult, null, 2)}
                  </pre>
                )}
              </div>

              {/* Polkadot Only Example */}
              <div className="space-y-2">
                <h3 className="font-medium">Polkadot Address Only</h3>
                <AddressInput
                  label="Polkadot Address"
                  placeholder="Enter Polkadot address..."
                  format="ss58"
                  withIdentityLookup={true}
                />
              </div>

              {/* Ethereum Only Example */}
              <div className="space-y-2">
                <h3 className="font-medium">Ethereum Address Only</h3>
                <AddressInput
                  label="Ethereum Address"
                  placeholder="Enter Ethereum address..."
                  format="eth"
                  // withEnsLookup={true}
                  // ethProviderUrl="https://eth-mainnet.alchemyapi.io/v2/demo"
                />
              </div>

              {/* Truncated Example */}
              <div className="space-y-2">
                <h3 className="font-medium">Truncated Display</h3>
                <AddressInput
                  label="Truncated Address"
                  placeholder="Enter address..."
                  format="both"
                  truncate={6}
                />
              </div>

              {/* Without Identicon */}
              <div className="space-y-2">
                <h3 className="font-medium">Without Identicon</h3>
                <AddressInput
                  label="Address (No Icon)"
                  placeholder="Enter address..."
                  format="both"
                  showIdenticon={false}
                />
              </div>

              {/* Disabled Example */}
              <div className="space-y-2">
                <h3 className="font-medium">Disabled State</h3>
                <AddressInput
                  label="Disabled Input"
                  placeholder="This is disabled..."
                  value="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Component Features</h2>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>
                Real-time address validation for SS58 (Polkadot) and Ethereum
                formats
              </li>
              <li>Identity lookup for Polkadot addresses using PAPI</li>
              <li>
                Visual feedback with validation states (green/red borders)
              </li>
              <li>Loading indicators during API calls</li>
              <li>Optional identicon display</li>
              <li>Address truncation for better UI</li>
              <li>Connection status awareness</li>
              <li>TypeScript support with full type safety</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Usage</h2>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
                {`import { AddressInput } from "@/registry/dot-ui/blocks/address-input/components/address-input.papi";

// Basic usage
<AddressInput
  label="Recipient Address"
  placeholder="Enter address..."
  value={address}
  onChange={setAddress}
  format="ss58"
  withIdentityLookup={true}
/>

// With identity callback
<AddressInput
  format="both"
  onIdentityFound={(identity) => {
    console.log("Identity found:", identity);
  }}
/>`}
              </pre>
            </div>
          </div>
        </div>
      </PolkadotProvider>
    </QueryClientProvider>
  );
}
