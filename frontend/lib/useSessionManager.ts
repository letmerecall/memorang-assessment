"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "lesson_thread_id";

export function useSessionManager() {
  const [storedThreadId, setStoredThreadId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStoredThreadId(localStorage.getItem(STORAGE_KEY));
    setLoaded(true);
  }, []);

  function saveThreadId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setStoredThreadId(id);
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    setStoredThreadId(null);
  }

  return { storedThreadId, saveThreadId, clearSession, loaded };
}
