// Jest globals and jest-dom types
import "@testing-library/jest-dom";

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string): R;
      toHaveAttribute(attribute: string, value?: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveValue(value: string | number): R;
    }
  }
}

export {};
