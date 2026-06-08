import { describe, expect, it } from "vitest";
import { getStatus } from "@/components/ProgressSidebar";

describe("getStatus", () => {
  it("marks earlier objectives as done", () => {
    expect(getStatus(0, 2)).toBe("done");
  });

  it("marks current objective", () => {
    expect(getStatus(2, 2)).toBe("current");
  });

  it("marks later objectives as pending", () => {
    expect(getStatus(3, 2)).toBe("pending");
  });
});
