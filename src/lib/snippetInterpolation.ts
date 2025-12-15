import { prisma } from "@/lib/prisma";

/**
 * Interpolate context snippets in a text string.
 * Replaces {{snippet_key}} with the snippet's content.
 *
 * @param text - The text containing {{key}} placeholders
 * @returns The text with snippets expanded
 */
export async function interpolateSnippets(text: string): Promise<string> {
  // Find all {{key}} patterns
  const pattern = /\{\{([a-z][a-z0-9_]*)\}\}/g;
  const matches = text.match(pattern);

  if (!matches || matches.length === 0) {
    return text;
  }

  // Extract unique keys
  const keys = [...new Set(matches.map(m => m.slice(2, -2)))];

  // Fetch all matching snippets in one query
  const snippets = await prisma.contextSnippet.findMany({
    where: {
      key: { in: keys },
      isActive: true,
    },
    select: {
      key: true,
      content: true,
    },
  });

  // Build a map for fast lookup
  const snippetMap = new Map(snippets.map(s => [s.key, s.content]));

  // Replace all placeholders
  let result = text;
  for (const key of keys) {
    const content = snippetMap.get(key);
    if (content) {
      // Replace all occurrences of {{key}}
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), content);
    }
    // If snippet not found, leave the placeholder as-is (user can see what's missing)
  }

  return result;
}

/**
 * Synchronous version that takes pre-fetched snippets.
 * Useful when you've already fetched snippets.
 */
export function interpolateSnippetsSync(
  text: string,
  snippets: Array<{ key: string; content: string }>
): string {
  const snippetMap = new Map(snippets.map(s => [s.key, s.content]));

  return text.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (match, key) => {
    return snippetMap.get(key) || match;
  });
}

/**
 * Check which snippets are used in a text (for validation/preview)
 */
export function getSnippetKeysFromText(text: string): string[] {
  const pattern = /\{\{([a-z][a-z0-9_]*)\}\}/g;
  const matches = text.match(pattern);

  if (!matches) return [];

  return [...new Set(matches.map(m => m.slice(2, -2)))];
}
