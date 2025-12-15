import Anthropic from "@anthropic-ai/sdk";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";

/**
 * Get an initialized Anthropic client.
 * Throws if ANTHROPIC_API_KEY is not configured.
 */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey });
}

/**
 * Parse JSON from LLM response text, stripping markdown code fences if present.
 */
export function parseJsonResponse<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const withoutFence = stripCodeFence(trimmed);

  try {
    return JSON.parse(withoutFence) as T;
  } catch {
    // Try to extract JSON object as fallback
    const match = withoutFence.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("Failed to parse LLM response as JSON");
  }
}

/**
 * Strip markdown code fences from a string.
 */
export function stripCodeFence(value: string): string {
  if (!value.startsWith("```")) {
    return value;
  }

  const lines = value.split("\n");
  if (lines.length <= 2) {
    return value;
  }

  // Remove opening fence line (e.g., ```json)
  lines.shift();

  // Remove closing fence if present
  if (lines[lines.length - 1]?.trim() === "```") {
    lines.pop();
  }

  return lines.join("\n").trim();
}

/**
 * Fetch URL content with SSRF protection and standard validation.
 * Returns null if fetch fails, content is invalid, or URL fails SSRF check.
 */
export async function fetchUrlContent(
  urlString: string,
  options: {
    maxLength?: number;
    userAgent?: string;
  } = {}
): Promise<string | null> {
  const { maxLength = 15000, userAgent = "TransparentTrust/1.0" } = options;

  // SSRF protection: validate URL before fetching
  const ssrfCheck = await validateUrlForSSRF(urlString);
  if (!ssrfCheck.valid) {
    console.warn(`SSRF check failed for URL ${urlString}: ${ssrfCheck.error}`);
    return null;
  }

  try {
    const response = await fetch(urlString, {
      headers: { "User-Agent": userAgent },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${urlString}: ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text")) {
      console.warn(`Skipping non-text content from ${urlString}`);
      return null;
    }

    const text = await response.text();
    return text.slice(0, maxLength);
  } catch (error) {
    console.warn(`Error fetching ${urlString}:`, error);
    return null;
  }
}
