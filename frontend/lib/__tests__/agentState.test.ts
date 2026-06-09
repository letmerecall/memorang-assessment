import { describe, expect, it } from "vitest";
import { AGENT_STATE_RESET_FIELDS, RESET_STATE } from "@/lib/agentState";

describe("RESET_STATE", () => {
  it("includes all agent state fields the UI resets", () => {
    for (const field of AGENT_STATE_RESET_FIELDS) {
      expect(field in RESET_STATE).toBe(true);
    }
  });

  it("clears tutor-related fields", () => {
    expect(RESET_STATE.asked_tutor).toBe(false);
    expect(RESET_STATE.last_tutor_reply).toBe(null);
  });
});
