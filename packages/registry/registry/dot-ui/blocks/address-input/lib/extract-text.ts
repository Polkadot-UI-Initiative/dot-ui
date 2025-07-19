// Helper function to safely extract text from papi encoded types
export const extractText = (value: unknown): string | undefined => {
  // Check if value exists
  if (!value) return undefined;

  // If it's already a string, return it
  if (typeof value === "string") return value;

  // Check if it has asText method at runtime (PAPI encoded types)
  if (value && typeof value === "object" && "asText" in value) {
    try {
      const textMethod = (value as Record<string, unknown>).asText;
      if (typeof textMethod === "function") {
        return textMethod.call(value) as string;
      }
    } catch (error) {
      console.warn("Failed to call asText method:", error);
    }
  }

  // Check if it has a text property (some PAPI types)
  if (value && typeof value === "object" && "text" in value) {
    const textValue = (value as Record<string, unknown>).text;
    if (typeof textValue === "string") return textValue;
  }

  // Fallback to toString for other types
  try {
    return String(value);
  } catch {
    return undefined;
  }
};
