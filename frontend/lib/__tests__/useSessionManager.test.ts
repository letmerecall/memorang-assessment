import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionManager } from "@/lib/useSessionManager";

const STORAGE_KEY = "lesson_thread_id";

function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  };
}

describe("useSessionManager", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads stored thread id from localStorage after mount", async () => {
    localStorage.setItem(STORAGE_KEY, "saved-thread");

    const { result } = renderHook(() => useSessionManager());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.storedThreadId).toBe("saved-thread");
  });

  it("saveThreadId persists to localStorage", async () => {
    const { result } = renderHook(() => useSessionManager());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.saveThreadId("new-thread");
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("new-thread");
    expect(result.current.storedThreadId).toBe("new-thread");
  });

  it("clearSession removes stored thread", async () => {
    localStorage.setItem(STORAGE_KEY, "old-thread");

    const { result } = renderHook(() => useSessionManager());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.clearSession();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    expect(result.current.storedThreadId).toBe(null);
  });
});
