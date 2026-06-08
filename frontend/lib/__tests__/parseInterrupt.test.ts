import { describe, expect, it } from "vitest";
import { parseInterruptValue } from "@/lib/parseInterrupt";

describe("parseInterruptValue", () => {
  it("parses JSON strings", () => {
    expect(parseInterruptValue<{ type: string }>('{"type":"summary"}')).toEqual({
      type: "summary",
    });
  });

  it("passes through objects", () => {
    const value = { type: "mcq", content: { question: "Q?" } };
    expect(parseInterruptValue(value)).toEqual(value);
  });

  it("returns null for invalid JSON", () => {
    expect(parseInterruptValue("{not json")).toBeNull();
  });

  it("returns null for unsupported values", () => {
    expect(parseInterruptValue(undefined)).toBeNull();
    expect(parseInterruptValue(42)).toBeNull();
  });
});
