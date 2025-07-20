# AddressInput Component Testing

This document describes the testing setup and approach for the AddressInput
component.

## Test Location

Tests are located in the generic registry package directory for better
organization:

- **Test File**: `packages/registry/__tests__/address-input.papi.test.tsx`
- **Jest Config**: `packages/registry/jest.config.js`
- **Setup File**: `packages/registry/jest.setup.js`

## Test Setup

### Required Dependencies

To run the tests, you'll need to install the following dev dependencies:

```bash
pnpm add -D @testing-library/react @testing-library/jest-dom @types/jest jest-environment-jsdom ts-jest
```

### Running Tests

Once dependencies are installed, uncomment the test code in
`packages/registry/__tests__/address-input.papi.test.tsx` and run:

```bash
# From the registry package directory
cd packages/registry

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

## Test Coverage

The test suite covers:

### 🔍 Address Validation

- ✅ Valid SS58 address recognition
- ✅ Invalid SS58 address rejection
- ✅ Valid Ethereum address recognition
- ✅ Invalid Ethereum address rejection
- ✅ Both format support (SS58 + Ethereum)

### 🆔 Identity Lookup

- ✅ Identity information display when found
- ✅ Loading state during identity lookup
- ✅ No identity found message
- ✅ Identity callback invocation

### 🎛️ UI Interactions

- ✅ onChange callback on valid address entry
- ✅ onIdentityFound callback when identity discovered
- ✅ Identicon visibility toggle
- ✅ Address truncation display

### 📋 Copy Functionality

- ✅ Copy button appearance for valid addresses
- ✅ Clipboard API integration
- ✅ Copy success feedback

### 🔍 Search Functionality

- ✅ Search dropdown display
- ✅ Identity search results
- ✅ Address selection from dropdown

### ⚠️ Error Handling

- ✅ Empty address input handling
- ✅ Connection warning display when chain disconnected
- ✅ Validation error display

### 🔌 Provider Integration

- ✅ AddressInputWithProvider wrapper component
- ✅ ChainId prop support

## Test Structure

### Mocking Strategy

The tests use comprehensive mocking for:

- **PAPI Provider**: Mock `usePapi` hook with controlled responses
- **Identity Hooks**: Mock `usePolkadotIdentity` and `useIdentityByDisplayName`
- **Web APIs**: Mock clipboard, ResizeObserver, and matchMedia
- **React Query**: Mock QueryClient for cache management

### Test Patterns

Each test follows the **Arrange-Act-Assert** pattern:

1. **Arrange**: Set up component with required props and mocks
2. **Act**: Simulate user interactions (typing, clicking, focusing)
3. **Assert**: Verify expected UI states and callback invocations

### Mock Data

Tests use realistic mock data including:

- Valid Polkadot addresses: `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`
- Valid Ethereum addresses: `0x742d35Cc6634C0532925a3b8D1C9fD00c4f5a10e`
- Identity data with display names and verification status

## Best Practices

### ✅ Do

- Use `waitFor` for async operations
- Mock external dependencies properly
- Test user interactions, not implementation details
- Include both positive and negative test cases
- Test error boundaries and edge cases

### ❌ Don't

- Test internal component state directly
- Rely on exact DOM structure matches
- Skip async operation waiting
- Mock React itself (unless absolutely necessary)
- Write tests that depend on other tests

## Continuous Integration

To integrate with CI/CD:

1. Add test command to `packages/registry/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --ci --coverage --passWithNoTests"
  }
}
```

2. Include in GitHub Actions workflow:

```yaml
- name: Run tests
  run: |
    cd packages/registry
    pnpm test:ci
```

## Performance Considerations

- Tests are configured with `retry: false` for faster execution
- Mocks prevent actual API calls during testing
- Setup files handle common Web API mocking
- Coverage reports help identify untested code paths

## Debugging Tests

For debugging failing tests:

1. Use `screen.debug()` to see rendered component
2. Add `console.log` statements in test code
3. Run single test with `jest --testNamePattern="test name"`
4. Check mock call history with `expect(mockFn).toHaveBeenCalledWith(...)`
