export function parseInterruptValue<T>(raw: unknown): T | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as T;
  }
  return null;
}
