import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract error message from API response.
 * Handles both old format ({ error: "string" }) and new format ({ error: { message: "string" } }).
 */
export function getApiErrorMessage(
  data: { error?: string | { message?: string } },
  fallback = "An error occurred"
): string {
  if (!data.error) return fallback;
  if (typeof data.error === "string") return data.error;
  return data.error?.message || fallback;
}
