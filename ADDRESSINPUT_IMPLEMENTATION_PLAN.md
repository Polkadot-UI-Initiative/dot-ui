# AddressInput Component Implementation Plan

## Overview

Implementation plan for the `AddressInput` component as specified in
[Issue #1](https://github.com/Polkadot-UI-Initiative/dot-ui/issues/1#issue-3218290132).

## Component Requirements

### Core Functionality

- ✅ **Input validation** (SS58 + Ethereum addresses)
- ✅ **Identity lookup** (Polkadot identity + ENS)
- ✅ **State management** (error, loading, success states)
- ✅ **Hook form integration** (react-hook-form compatible)
- ✅ **shadcn UI integration** (using shadcn Input component)

### Props Interface

```typescript
interface AddressInputProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  format?: "eth" | "ss58" | "both"; // default: "ss58"
  withIdentityLookup?: boolean; // default: true
  withEnsLookup?: boolean; // default: false
  onIdentityFound?: (identity: IdentityResult) => void;
  ethProviderUrl?: string; // RPC endpoint for ENS
  truncate?: boolean | number;
  showIdenticon?: boolean; // default: true
}
```

## PAPI API Patterns

Based on the existing block-number implementation:

- **Hook**: Use `usePapi()` from the provider
- **Destructure**: `{ api, isLoading, currentChain, isConnected }`
- **Connection checks**: `isLoading(currentChain)` and
  `isConnected(currentChain)`
- **API calls**: `api.query.PalletName.StorageItem.getValue()`
- **Subscriptions**: `api.query.PalletName.StorageItem.watchValue("best")`

## Implementation Strategy

### Phase 1: Core Component Structure (Week 1)

#### 1.1 Base Component Setup (PAPI)

```typescript
// packages/registry/registry/dot-ui/blocks/address-input/components/address-input.papi.tsx
import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/registry/dot-ui/ui/input";
import { Label } from "@/registry/dot-ui/ui/label";
import { Identicon } from "@/registry/dot-ui/components/identicon";
import { usePapi } from "@/registry/dot-ui/providers/papi-provider";

export const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  (
    {
      format = "ss58",
      withIdentityLookup = true,
      showIdenticon = true,
      ...props
    },
    ref
  ) => {
    const { api, isLoading, currentChain, isConnected } = usePapi();
    // Component implementation using PAPI
  }
);
```

#### 1.2 Validation Logic

```typescript
// packages/registry/registry/dot-ui/lib/address-validation.ts
import { decodeAddress, encodeAddress } from "@polkadot/keyring";
import { hexToU8a, isHex } from "@polkadot/util";
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
    } catch (ss58Error) {
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
    } catch (ethError) {
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
```

### Phase 2: Identity Lookup Integration (Week 2)

#### 2.1 Polkadot Identity Lookup (PAPI)

```typescript
// packages/registry/registry/dot-ui/blocks/address-input/hooks/use-identity.papi.ts
import { useQuery } from "@tanstack/react-query";
import { usePapi } from "@/registry/dot-ui/providers/papi-provider";

export interface PolkadotIdentity {
  display?: string;
  legal?: string;
  email?: string;
  twitter?: string;
  verified: boolean;
}

export function usePolkadotIdentity(address: string) {
  const { api, isLoading, currentChain, isConnected } = usePapi();

  return useQuery({
    queryKey: ["polkadot-identity", address, currentChain],
    queryFn: async (): Promise<PolkadotIdentity | null> => {
      if (
        !api ||
        !address ||
        isLoading(currentChain) ||
        !isConnected(currentChain)
      ) {
        return null;
      }

      try {
        const identity = await api.query.Identity.IdentityOf.getValue(address);
        if (!identity) return null;

        return {
          display: identity.info.display?.asText || "",
          legal: identity.info.legal?.asText || "",
          email: identity.info.email?.asText || "",
          twitter: identity.info.twitter?.asText || "",
          verified: identity.judgements.some(
            ([, judgement]) =>
              judgement.type === "Reasonable" || judgement.type === "KnownGood"
          ),
        };
      } catch (error) {
        console.error("Identity lookup failed:", error);
        return null;
      }
    },
    enabled:
      !!api && !!address && address.length > 0 && isConnected(currentChain),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

#### 2.2 ENS Lookup

```typescript
// packages/registry/registry/dot-ui/hooks/use-ens-lookup.ts
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";

export interface EnsResult {
  name?: string;
  avatar?: string;
}

export function useEnsLookup(address: string, providerUrl?: string) {
  return useQuery({
    queryKey: ["ens-lookup", address, providerUrl],
    queryFn: async (): Promise<EnsResult | null> => {
      if (!providerUrl || !address) return null;

      try {
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const name = await provider.lookupAddress(address);

        if (!name) return null;

        const resolver = await provider.getResolver(name);
        const avatar = await resolver?.getAvatar();

        return { name, avatar: avatar || undefined };
      } catch (error) {
        console.error("ENS lookup failed:", error);
        return null;
      }
    },
    enabled: !!providerUrl && !!address && ethers.isAddress(address),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### Phase 3: UI States & Integration (Week 3)

#### 3.1 Component State Management

```typescript
// Main AddressInput component with state management
export const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  ({
    value = '',
    onChange,
    format = "ss58",
    withIdentityLookup = true,
    withEnsLookup = false,
    onIdentityFound,
    ethProviderUrl,
    truncate,
    showIdenticon = true,
    ...props
  }, ref) => {
    const [inputValue, setInputValue] = useState(value)
    const [validationResult, setValidationResult] = useState<ValidationResult>()
    const [debouncedAddress, setDebouncedAddress] = useState('')

    // Debounce address for API calls
    useEffect(() => {
      const timer = setTimeout(() => {
        if (validationResult?.isValid) {
          setDebouncedAddress(validationResult.normalizedAddress || inputValue)
        }
      }, 500)
      return () => clearTimeout(timer)
    }, [inputValue, validationResult])

        // Identity lookups
    const polkadotIdentity = usePolkadotIdentity(
      withIdentityLookup && validationResult?.type === 'ss58'
        ? debouncedAddress
        : ''
    )

    const ensResult = useEnsLookup(
      withEnsLookup && validationResult?.type === 'eth'
        ? debouncedAddress
        : '',
      ethProviderUrl
    )

    // Validation on input change
    useEffect(() => {
      const result = validateAddress(inputValue, format)
      setValidationResult(result)

      if (result.isValid && onChange) {
        onChange(result.normalizedAddress || inputValue)
      }
    }, [inputValue, format, onChange])

    // Notify parent when identity is found
    useEffect(() => {
      if (polkadotIdentity.data && onIdentityFound) {
        onIdentityFound({
          type: 'polkadot',
          data: polkadotIdentity.data
        })
      }
    }, [polkadotIdentity.data, onIdentityFound])

    useEffect(() => {
      if (ensResult.data && onIdentityFound) {
        onIdentityFound({
          type: 'ens',
          data: ensResult.data
        })
      }
    }, [ensResult.data, onIdentityFound])

    // Loading state
    const isIdentityLoading = polkadotIdentity.isLoading || ensResult.isLoading
    const isApiLoading = isLoading(currentChain)

    return (
      <div className="space-y-2">
        {props.label && <Label>{props.label}</Label>}

        <div className="relative">
          <Input
            ref={ref}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className={cn(
              showIdenticon && "pl-12",
              validationResult?.isValid === false && "border-red-500",
              validationResult?.isValid === true && "border-green-500"
            )}
            {...props}
          />

          {/* Identicon */}
          {showIdenticon && validationResult?.isValid && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Identicon
                address={validationResult.normalizedAddress || inputValue}
                size={20}
              />
            </div>
          )}

          {/* Loading spinner */}
          {(isIdentityLoading || isApiLoading) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>

        {/* Identity display */}
        {polkadotIdentity.data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{polkadotIdentity.data.display}</span>
            {polkadotIdentity.data.verified && (
              <Badge variant="secondary">Verified</Badge>
            )}
          </div>
        )}

        {ensResult.data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{ensResult.data.name}</span>
          </div>
        )}

        {/* Error display */}
        {validationResult?.error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            <span>{validationResult.error}</span>
          </div>
        )}
      </div>
    )
  }
)

AddressInput.displayName = "AddressInput"
```

#### 3.2 React Hook Form Integration

```typescript
// packages/registry/registry/dot-ui/components/form-address-input.tsx
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

interface FormAddressInputProps<T extends FieldValues>
  extends Omit<AddressInputProps, 'value' | 'onChange'> {
  control: Control<T>
  name: FieldPath<T>
}

export function FormAddressInput<T extends FieldValues>({
  control,
  name,
  ...props
}: FormAddressInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <AddressInput
          {...field}
          {...props}
          // Pass validation errors from react-hook-form if no custom validation
        />
      )}
    />
  )
}
```

#### 3.3 Documentation Page (PAPI)

```typescript
// packages/registry/registry/dot-ui/blocks/address-input/page.papi.tsx
import { AddressInput } from "./components/address-input.papi";
import { useState } from "react";
import { PapiProvider } from "@/registry/dot-ui/providers/papi-provider";

export default function AddressInputPage() {
  const [address, setAddress] = useState("");
  const [identityResult, setIdentityResult] = useState(null);

  return (
    <PapiProvider>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">AddressInput Component</h1>
          <p className="text-muted-foreground">
            Input component with SS58/Ethereum validation and identity lookup
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Examples</h2>

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
              withEnsLookup={true}
              ethProviderUrl="https://eth-mainnet.alchemyapi.io/v2/demo"
            />
          </div>
        </div>
      </div>
    </PapiProvider>
  );
}
```

### Phase 4: Testing & Polish (Week 4)

#### 4.1 Component Tests

```typescript
// packages/registry/registry/dot-ui/components/__tests__/address-input.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddressInput } from '../address-input'

describe('AddressInput', () => {
  it('validates SS58 addresses correctly', async () => {
    render(
      <AddressInput
        format="ss58"
        placeholder="Enter Polkadot address"
      />
    )

    const input = screen.getByPlaceholderText('Enter Polkadot address')
    fireEvent.change(input, {
      target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }
    })

    await waitFor(() => {
      expect(input).toHaveClass('border-green-500')
    })
  })

  it('validates Ethereum addresses correctly', async () => {
    render(
      <AddressInput
        format="eth"
        placeholder="Enter Ethereum address"
      />
    )

    const input = screen.getByPlaceholderText('Enter Ethereum address')
    fireEvent.change(input, {
      target: { value: '0x742d35Cc6634C0532925a3b8D1C9fD00c4' }
    })

    await waitFor(() => {
      expect(input).toHaveClass('border-red-500')
    })
  })

  it('shows identity information when found', async () => {
    // Mock identity lookup
    render(
      <AddressInput
        format="ss58"
        withIdentityLookup={true}
      />
    )

    // Test implementation
  })
})
```

#### 4.2 Storybook Documentation

```typescript
// packages/registry/registry/dot-ui/components/stories/address-input.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { AddressInput } from "../address-input";

const meta: Meta<typeof AddressInput> = {
  title: "Components/AddressInput",
  component: AddressInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter address...",
  },
};

export const PolkadotOnly: Story = {
  args: {
    format: "ss58",
    placeholder: "Enter Polkadot address...",
    withIdentityLookup: true,
  },
};

export const EthereumOnly: Story = {
  args: {
    format: "eth",
    placeholder: "Enter Ethereum address...",
    withEnsLookup: true,
    ethProviderUrl: "https://eth-mainnet.alchemyapi.io/v2/your-key",
  },
};

export const BothFormats: Story = {
  args: {
    format: "both",
    placeholder: "Enter any address...",
    withIdentityLookup: true,
    withEnsLookup: true,
    ethProviderUrl: "https://eth-mainnet.alchemyapi.io/v2/your-key",
  },
};
```

## Registry Structure & API Libraries

This project supports multiple Polkadot API libraries with separate registries:

### Registry Types

- **PAPI Registry** (`registry-papi.json`): Components using Polkadot API (papi)
- **Dedot Registry** (`registry-dedot.json`): Components using Dedot API

### Implementation Strategy

We'll implement the **PAPI version first**, following the established patterns:

- Files use `.papi.tsx` suffix for papi-specific implementations
- Components live in `registry/dot-ui/blocks/` structure
- Each block contains components, hooks, and documentation

## File Structure (PAPI Implementation)

```
packages/registry/registry/dot-ui/
├── blocks/
│   └── address-input/
│       ├── components/
│       │   └── address-input.papi.tsx
│       ├── hooks/
│       │   ├── use-identity.papi.ts
│       │   └── use-ens-lookup.papi.ts
│       └── page.papi.tsx
├── lib/
│   ├── address-validation.ts
│   ├── config.papi.ts
│   └── utils.polkadot-ui.ts
└── providers/
    └── papi-provider.tsx
```

## Dependencies Required

```json
{
  "dependencies": {
    "@polkadot/keyring": "^12.0.0",
    "@polkadot/util": "^12.0.0",
    "@polkadot/api": "^10.0.0",
    "ethers": "^6.0.0",
    "@tanstack/react-query": "^5.0.0",
    "react-hook-form": "^7.0.0"
  }
}
```

## Success Criteria

- ✅ **Validation**: Both SS58 and Ethereum address validation working
- ✅ **Identity Lookup**: Polkadot identity and ENS resolution working
- ✅ **States**: Clear loading, error, and success states
- ✅ **Integration**: Seamless react-hook-form integration
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation
- ✅ **Performance**: Debounced API calls, cached results
- ✅ **Documentation**: Complete Storybook docs and examples

## Timeline (PAPI Implementation)

- **Week 1**: Core component + validation logic
- **Week 2**: Identity lookup integration using PAPI
- **Week 3**: UI polish + documentation page
- **Week 4**: Testing + Storybook integration

## Future Work

- **Dedot Implementation**: After PAPI version is complete, create dedot
  versions:
  - `address-input.dedot.tsx`
  - `use-identity.dedot.ts`
  - `page.dedot.tsx`
- **Registry Integration**: Add component entries to both `registry-papi.json`
  and `registry-dedot.json`

This implementation addresses all requirements from
[Issue #1](https://github.com/Polkadot-UI-Initiative/dot-ui/issues/1#issue-3218290132)
and provides a production-ready PAPI component for the dot-ui library.
