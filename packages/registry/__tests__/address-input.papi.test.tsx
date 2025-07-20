/**
 * @jest-environment jsdom
 */

/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock modules BEFORE importing the components
const mockUsePapi = jest.fn().mockReturnValue({
  api: {
    query: {
      Identity: {
        IdentityOf: {
          getValue: jest.fn().mockResolvedValue(null),
        },
      },
    },
  },
  isLoading: jest.fn().mockReturnValue(false),
  currentChain: "polkadot",
  isConnected: jest.fn().mockReturnValue(true),
});

const mockUsePolkadotIdentity = jest.fn().mockReturnValue({
  data: null,
  isLoading: false,
  isFetching: false,
  error: null,
});

const mockUseIdentityByDisplayName = jest.fn().mockReturnValue({
  data: [],
  isLoading: false,
  error: null,
});

const MockPolkadotProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="polkadot-provider">{children}</div>
);

// Mock the providers and hooks
jest.mock("../registry/dot-ui/providers/papi-provider", () => ({
  PolkadotProvider: MockPolkadotProvider,
  usePapi: mockUsePapi,
}));

jest.mock(
  "../registry/dot-ui/blocks/address-input/hooks/use-identity.papi",
  () => ({
    usePolkadotIdentity: mockUsePolkadotIdentity,
  })
);

jest.mock(
  "../registry/dot-ui/blocks/address-input/hooks/use-search-identity.papi",
  () => ({
    useIdentityByDisplayName: mockUseIdentityByDisplayName,
  })
);

// Import components AFTER mocking
import {
  AddressInput,
  AddressInputWithProvider,
} from "../registry/dot-ui/blocks/address-input/components/address-input.papi";
import { PolkadotProvider } from "../registry/dot-ui/providers/papi-provider";

// Test wrapper with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <PolkadotProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PolkadotProvider>
  );
}

describe("AddressInput", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Address Validation", () => {
    it("validates SS58 addresses correctly", async () => {
      render(
        <TestWrapper>
          <AddressInput format="ss58" placeholder="Enter Polkadot address" />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText("Enter Polkadot address");

      // Valid SS58 address
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-green-500");
        expect(screen.getByText("Valid Polkadot address")).toBeInTheDocument();
      });
    });

    it("rejects invalid SS58 addresses", async () => {
      render(
        <TestWrapper>
          <AddressInput format="ss58" placeholder="Enter Polkadot address" />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText("Enter Polkadot address");

      // Invalid SS58 address
      fireEvent.change(input, {
        target: { value: "invalid-address" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-red-500");
        expect(screen.getByText(/Invalid.*address/)).toBeInTheDocument();
      });
    });

    it("validates Ethereum addresses correctly", async () => {
      render(
        <TestWrapper>
          <AddressInput format="eth" placeholder="Enter Ethereum address" />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText("Enter Ethereum address");

      // Valid Ethereum address
      fireEvent.change(input, {
        target: { value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-green-500");
        expect(screen.getByText("Valid Ethereum address")).toBeInTheDocument();
      });
    });

    it("rejects invalid Ethereum addresses", async () => {
      render(
        <TestWrapper>
          <AddressInput format="eth" placeholder="Enter Ethereum address" />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText("Enter Ethereum address");

      // Invalid Ethereum address (too short)
      fireEvent.change(input, {
        target: { value: "0x742d35Cc6634C0532925a3b8D1C9fD00c4" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-red-500");
        expect(screen.getByText(/Invalid.*address/)).toBeInTheDocument();
      });
    });

    it("supports both format validation", async () => {
      render(
        <TestWrapper>
          <AddressInput format="both" placeholder="Enter any address" />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText("Enter any address");

      // Test with SS58 address
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-green-500");
        expect(screen.getByText("Valid Polkadot address")).toBeInTheDocument();
      });

      // Test with Ethereum address
      fireEvent.change(input, {
        target: { value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("border-green-500");
        expect(screen.getByText("Valid Ethereum address")).toBeInTheDocument();
      });
    });
  });

  describe("Identity Lookup", () => {
    it("shows identity information when found", async () => {
      const mockIdentity = {
        data: {
          display: "Alice",
          verified: true,
        },
        isLoading: false,
        isFetching: false,
        error: null,
      };

      // Mock the identity hook to return data
      mockUsePolkadotIdentity.mockReturnValue(mockIdentity);

      render(
        <TestWrapper>
          <AddressInput format="ss58" withIdentityLookup={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(screen.getByText("Identity: Alice")).toBeInTheDocument();
        expect(screen.getByText("Verified")).toBeInTheDocument();
      });
    });

    it("shows loading state during identity lookup", async () => {
      const mockIdentity = {
        data: null,
        isLoading: true,
        isFetching: true,
        error: null,
      };

      mockUsePolkadotIdentity.mockReturnValue(mockIdentity);

      render(
        <TestWrapper>
          <AddressInput format="ss58" withIdentityLookup={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(screen.getByText("Looking up identity...")).toBeInTheDocument();
      });
    });

    it("shows no identity found message", async () => {
      const mockIdentity = {
        data: null,
        isLoading: false,
        isFetching: false,
        error: null,
      };

      mockUsePolkadotIdentity.mockReturnValue(mockIdentity);

      render(
        <TestWrapper>
          <AddressInput format="ss58" withIdentityLookup={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(screen.getByText("• No identity found")).toBeInTheDocument();
      });
    });
  });

  describe("UI Interactions", () => {
    it("calls onChange when valid address is entered", async () => {
      const mockOnChange = jest.fn();

      render(
        <TestWrapper>
          <AddressInput format="ss58" onChange={mockOnChange} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      const validAddress = "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9";

      fireEvent.change(input, {
        target: { value: validAddress },
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(validAddress);
      });
    });

    it("calls onIdentityFound when identity is discovered", async () => {
      const mockOnIdentityFound = jest.fn();
      const mockIdentity = {
        data: {
          display: "Alice",
          verified: true,
        },
        isLoading: false,
        isFetching: false,
        error: null,
      };

      mockUsePolkadotIdentity.mockReturnValue(mockIdentity);

      render(
        <TestWrapper>
          <AddressInput
            format="ss58"
            withIdentityLookup={true}
            onIdentityFound={mockOnIdentityFound}
          />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(mockOnIdentityFound).toHaveBeenCalledWith({
          type: "polkadot",
          data: mockIdentity.data,
        });
      });
    });

    it("shows and hides identicon based on prop", async () => {
      const { rerender } = render(
        <TestWrapper>
          <AddressInput format="ss58" showIdenticon={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(input).toHaveClass("pl-10"); // Left padding for identicon
      });

      // Rerender without identicon
      rerender(
        <TestWrapper>
          <AddressInput format="ss58" showIdenticon={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(input).not.toHaveClass("pl-10");
      });
    });

    it("truncates display when truncate prop is set", async () => {
      render(
        <TestWrapper>
          <AddressInput
            format="ss58"
            truncate={6}
            value="5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9"
          />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("5C4hrf...yUpbm9");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Copy Functionality", () => {
    // Mock clipboard API
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockImplementation(() => Promise.resolve()),
        },
      });
    });

    it("shows copy button for valid addresses", async () => {
      render(
        <TestWrapper>
          <AddressInput format="ss58" withCopyButton={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      // Focus out to show copy button
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByTitle("Copy address")).toBeInTheDocument();
      });
    });

    it("copies address to clipboard when copy button is clicked", async () => {
      render(
        <TestWrapper>
          <AddressInput format="ss58" withCopyButton={true} />
        </TestWrapper>
      );

      const validAddress = "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9";
      const input = screen.getByDisplayValue("");

      fireEvent.change(input, {
        target: { value: validAddress },
      });

      fireEvent.blur(input);

      await waitFor(() => {
        const copyButton = screen.getByTitle("Copy address");
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(validAddress);
    });
  });

  describe("Wrapped Component", () => {
    it("renders AddressInputWithProvider correctly", () => {
      render(
        <AddressInputWithProvider
          format="both"
          placeholder="Enter address..."
        />
      );

      expect(
        screen.getByPlaceholderText("Enter address...")
      ).toBeInTheDocument();
    });

    it("accepts chainId prop", () => {
      render(
        <AddressInputWithProvider
          chainId="paseo"
          format="ss58"
          placeholder="Enter Polkadot address"
        />
      );

      expect(
        screen.getByPlaceholderText("Enter Polkadot address")
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles empty address input", () => {
      render(
        <TestWrapper>
          <AddressInput format="ss58" />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "" } });

      // Should not show any validation state for empty input
      expect(input).not.toHaveClass("border-red-500");
      expect(input).not.toHaveClass("border-green-500");
    });

    it("shows connection warning when chain is disconnected", async () => {
      // Mock disconnected state
      mockUsePapi.mockReturnValue({
        api: null,
        isLoading: jest.fn().mockReturnValue(false),
        currentChain: "polkadot",
        isConnected: jest.fn().mockReturnValue(false),
      });

      render(
        <TestWrapper>
          <AddressInput format="ss58" />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, {
        target: { value: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9" },
      });

      await waitFor(() => {
        expect(screen.getByText(/Not connected to chain/)).toBeInTheDocument();
      });
    });
  });

  describe("Search Functionality", () => {
    it("shows search dropdown when typing identity name", async () => {
      const mockSearchResults = {
        data: [
          {
            address: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9",
            identity: { display: "Alice" },
          },
        ],
        isLoading: false,
        error: null,
      };

      mockUseIdentityByDisplayName.mockReturnValue(mockSearchResults);

      render(
        <TestWrapper>
          <AddressInput format="ss58" withIdentitySearch={true} />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "Alice" } });
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("5C4hrf...yUpbm9")).toBeInTheDocument();
      });
    });

    it("selects address from search dropdown", async () => {
      const mockOnChange = jest.fn();
      const mockSearchResults = {
        data: [
          {
            address: "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9",
            identity: { display: "Alice" },
          },
        ],
        isLoading: false,
        error: null,
      };

      mockUseIdentityByDisplayName.mockReturnValue(mockSearchResults);

      render(
        <TestWrapper>
          <AddressInput
            format="ss58"
            withIdentitySearch={true}
            onChange={mockOnChange}
          />
        </TestWrapper>
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "Alice" } });
      fireEvent.focus(input);

      await waitFor(() => {
        const result = screen.getByText("Alice");
        fireEvent.click(result);
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpbm9"
      );
    });
  });
});
