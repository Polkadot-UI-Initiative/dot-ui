# AddressInput Component

A comprehensive address input component for Polkadot and Ethereum addresses with
real-time validation and identity lookup.

## Features

- ✅ **Address Validation**: Real-time validation for SS58 (Polkadot) and
  Ethereum addresses
- ✅ **Identity Lookup**: Automatic Polkadot identity resolution using PAPI
- ✅ **Visual Feedback**: Color-coded validation states and loading indicators
- ✅ **Flexible Formats**: Support for SS58, Ethereum, or both address types
- ✅ **TypeScript**: Full type safety with comprehensive interfaces
- ✅ **Customizable**: Optional identicon, truncation, and styling options

## Installation

```bash
# Install required dependencies
pnpm add @polkadot/keyring ethers @tanstack/react-query
```

## Basic Usage

```tsx
import { AddressInput } from "@/registry/dot-ui/blocks/address-input";

function MyComponent() {
  const [address, setAddress] = useState("");

  return (
    <AddressInput
      label="Recipient Address"
      placeholder="Enter Polkadot address..."
      value={address}
      onChange={setAddress}
      format="ss58"
      withIdentityLookup={true}
    />
  );
}
```

## Props

| Prop                 | Type                                 | Default  | Description                          |
| -------------------- | ------------------------------------ | -------- | ------------------------------------ |
| `value`              | `string`                             | `""`     | Current input value                  |
| `onChange`           | `(value: string) => void`            | -        | Called when valid address is entered |
| `label`              | `string`                             | -        | Label text above input               |
| `placeholder`        | `string`                             | -        | Placeholder text                     |
| `disabled`           | `boolean`                            | `false`  | Disable the input                    |
| `format`             | `"ss58" \| "eth" \| "both"`          | `"ss58"` | Address format(s) to accept          |
| `withIdentityLookup` | `boolean`                            | `true`   | Enable Polkadot identity lookup      |
| `withEnsLookup`      | `boolean`                            | `false`  | Enable ENS lookup (TODO)             |
| `onIdentityFound`    | `(identity: IdentityResult) => void` | -        | Called when identity is found        |
| `ethProviderUrl`     | `string`                             | -        | Ethereum RPC URL for ENS             |
| `truncate`           | `boolean \| number`                  | `false`  | Truncate display (true=8 chars)      |
| `showIdenticon`      | `boolean`                            | `true`   | Show address identicon               |
| `className`          | `string`                             | -        | Additional CSS classes               |

## Examples

### Polkadot Address Only

```tsx
<AddressInput
  format="ss58"
  placeholder="Enter Polkadot address..."
  withIdentityLookup={true}
/>
```

### Ethereum Address Only

```tsx
<AddressInput
  format="eth"
  placeholder="Enter Ethereum address..."
  // withEnsLookup={true}  // TODO: Implement
  // ethProviderUrl="https://eth-mainnet.alchemyapi.io/v2/your-key"
/>
```

### Both Formats

```tsx
<AddressInput
  format="both"
  placeholder="Enter any address..."
  withIdentityLookup={true}
/>
```

### With Identity Callback

```tsx
<AddressInput
  format="ss58"
  onIdentityFound={(identity) => {
    console.log("Found identity:", identity.data.display);
  }}
/>
```

### Truncated Display

```tsx
<AddressInput
  format="both"
  truncate={6} // Shows first 6 and last 6 characters
/>
```

### Custom Styling

```tsx
<AddressInput className="border-2 border-blue-500" showIdenticon={false} />
```

## Validation States

The component shows different visual states:

- **Valid**: Green border with checkmark
- **Invalid**: Red border with error message
- **Loading**: Spinner while checking identity
- **Disconnected**: Warning when chain not connected

## Identity Lookup

When `withIdentityLookup` is enabled:

1. Valid SS58 addresses trigger identity lookup
2. Displays identity name if found
3. Shows verification status
4. Includes "PAPI" badge to indicate API source

## Types

```typescript
interface IdentityResult {
  type: "polkadot" | "ens";
  data: {
    display?: string;
    legal?: string;
    email?: string;
    twitter?: string;
    verified?: boolean;
  };
}

interface ValidationResult {
  isValid: boolean;
  type: "ss58" | "eth" | "unknown";
  error?: string;
  normalizedAddress?: string;
}
```

## Dependencies

- `@polkadot/keyring`: SS58 address validation
- `ethers`: Ethereum address validation
- `@tanstack/react-query`: Identity caching
- `lucide-react`: Icons
- PAPI provider for chain connection

## Future Enhancements

- [ ] ENS lookup for Ethereum addresses
- [ ] Real identicon integration
- [ ] Substrate parachain addresses
- [ ] React Hook Form integration helper
- [ ] Storybook documentation
- [ ] Unit tests

## Implementation Status

✅ **PAPI Version**: Fully implemented with Polkadot API support 🚧 **Dedot
Version**: Planned for future implementation

See `page.papi.tsx` for live examples and demonstrations.
