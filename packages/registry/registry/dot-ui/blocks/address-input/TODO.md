# AddressInput - TODO List

## Immediate Tasks (Phase 1)

### 🔧 Dependencies & Setup

- [ ] Install missing dependencies:
  - `@polkadot/keyring`
  - `@polkadot/util`
  - `ethers`
  - `@tanstack/react-query`
- [ ] Fix import paths for UI components
- [ ] Ensure `cn` utility is available in utils
- [ ] Add component to registry files

### 🐛 Bug Fixes

- [ ] Verify address validation works with real addresses

### 🎨 UI Components

- [ ] Create missing UI components if not available:
  - `Input` component
  - `Label` component
  - `Badge` component
- [ ] Implement real identicon component (currently placeholder)
- [ ] Style improvements and accessibility

## Phase 2 Enhancements

### 🔍 ENS Support

- [ ] Implement ENS lookup hook
- [ ] Add Ethereum provider integration
- [ ] Test ENS resolution with real addresses
- [ ] Add ENS avatar display

### 🧪 Testing

- [ ] Unit tests for validation logic
- [ ] Component tests with React Testing Library
- [ ] Integration tests with PAPI provider
- [ ] E2E tests for full workflow

### 📚 Documentation

- [ ] Storybook stories
- [ ] API documentation
- [ ] Usage examples
- [ ] Migration guide from existing components

## Phase 3 Advanced Features

### 🚀 Performance & UX

- [ ] Optimize debouncing strategy
- [ ] Add keyboard navigation
- [ ] Implement copy-to-clipboard
- [ ] Add QR code scanning support
- [ ] Address book integration

### 🔗 Integrations

- [ ] React Hook Form integration helper
- [ ] Formik integration
- [ ] Address validation rules engine
- [ ] Multi-chain address support

### 🎯 React Native Support

- [ ] Create React Native version
- [ ] Platform-specific optimizations
- [ ] Mobile-friendly interactions

## Registry Integration

### 📦 Component Registry

- [ ] Add to `registry-papi.json`:
  ```json
  {
    "name": "address-input",
    "type": "blocks:ui",
    "dependencies": ["@polkadot/keyring", "ethers"],
    "registryDependencies": ["input", "label", "badge"]
  }
  ```

### 🔄 Dedot Version

- [ ] Create `address-input.dedot.tsx`
- [ ] Create `use-identity.dedot.ts`
- [ ] Create `page.dedot.tsx`
- [ ] Add to `registry-dedot.json`

## Known Issues

### 🚨 Critical

- [ ] Identity query syntax needs verification with PAPI team
- [ ] Missing UI component dependencies
- [ ] Type safety issues in identity lookup

### ⚠️ Medium Priority

- [ ] Placeholder identicon should be replaced
- [ ] ENS lookup not implemented
- [ ] No tests coverage

### 🔍 Low Priority

- [ ] Address truncation could be smarter
- [ ] Loading states could be more sophisticated
- [ ] Error messages could be more descriptive

## Verification Checklist

Before marking as complete:

- [ ] All linter errors resolved
- [ ] Component renders without crashes
- [ ] Address validation works for both SS58 and Ethereum
- [ ] Identity lookup works with connected PAPI
- [ ] All props work as expected
- [ ] Documentation is accurate
- [ ] Examples in page.papi.tsx work
- [ ] Component is properly exported
- [ ] TypeScript types are correct
- [ ] Accessibility requirements met

## Future Considerations

- Multi-signature address support
- Hardware wallet integration
- Address validation for other Substrate chains
- Performance optimization for large address lists
- Internationalization support
- Dark/light theme support
- Custom validation rules
- Address format conversion utilities
