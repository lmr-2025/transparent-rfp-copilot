import { useEffect, useState } from "react";
import {
  PROMPT_VERSION_KEY,
  CURRENT_PROMPT_VERSION,
  QUESTION_PROMPT_SECTIONS_KEY,
  SKILL_PROMPT_SECTIONS_KEY,
} from "@/lib/promptStorage";

export function useStoredPrompt(storageKey: string, defaultValue: string) {
  const [prompt, setPrompt] = useState(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    // Check if prompt version has changed
    const storedVersion = window.localStorage.getItem(PROMPT_VERSION_KEY);
    if (storedVersion !== CURRENT_PROMPT_VERSION) {
      // Clear old prompts, sections, and update version
      window.localStorage.setItem(PROMPT_VERSION_KEY, CURRENT_PROMPT_VERSION);
      window.localStorage.setItem(storageKey, defaultValue);
      // Also clear sections to force reload of new defaults
      window.localStorage.removeItem(QUESTION_PROMPT_SECTIONS_KEY);
      window.localStorage.removeItem(SKILL_PROMPT_SECTIONS_KEY);
      return defaultValue;
    }

    return window.localStorage.getItem(storageKey) ?? defaultValue;
  });

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setPrompt(event.newValue ?? defaultValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey, defaultValue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, prompt);
  }, [prompt, storageKey]);

  return [prompt, setPrompt] as const;
}
