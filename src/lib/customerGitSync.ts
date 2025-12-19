/**
 * Customer Profile Git Sync
 *
 * Handles bidirectional sync between customers/ markdown files and database.
 * Pattern copied from skillGitSync.ts for consistency.
 */

import { exec } from "child_process";
import { promisify } from "util";
import {
  writeCustomerFile,
  getCustomerSlug,
  renameCustomerFile,
  deleteCustomerFile
} from "./customerFiles";
import type { CustomerFile } from "./customerFiles";

const execAsync = promisify(exec);

/**
 * Git author information for commits
 */
export interface GitAuthor {
  name: string;
  email: string;
}

/**
 * Save a customer to the customers/ directory and commit to git
 * @param slug - The customer slug (filename)
 * @param customer - The customer data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function saveCustomerAndCommit(
  slug: string,
  customer: CustomerFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // 1. Write customer file
  await writeCustomerFile(slug, customer);

  // 2. Git add
  const filepath = `customers/${slug}.md`;
  await execAsync(`git add "${filepath}"`);

  // 3. Check if there are changes to commit
  try {
    await execAsync("git diff --staged --quiet");
    // No changes, skip commit
    return null;
  } catch {
    // Has changes, proceed with commit
  }

  // 4. Git commit with author
  const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const authorString = `${author.name} <${author.email}>`;

  await execAsync(
    `git commit -m "${escapedMessage}" --author="${authorString}"`
  );

  // 5. Get the commit SHA
  const { stdout } = await execAsync("git rev-parse HEAD");
  return stdout.trim();
}

/**
 * Update a customer file and commit the changes
 * Handles slug changes (renames) automatically
 * @param oldSlug - Current customer slug (may be different if name changed)
 * @param customer - Updated customer data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function updateCustomerAndCommit(
  oldSlug: string,
  customer: CustomerFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const newSlug = getCustomerSlug(customer.name);

  // If slug changed (name changed), rename the file
  if (oldSlug !== newSlug) {
    await renameCustomerFile(oldSlug, newSlug);
    await execAsync(`git add "customers/${oldSlug}.md" "customers/${newSlug}.md"`);
  }

  // Write updated content
  await writeCustomerFile(newSlug, customer);
  await execAsync(`git add "customers/${newSlug}.md"`);

  // Check if there are changes to commit
  try {
    await execAsync("git diff --staged --quiet");
    return null; // No changes
  } catch {
    // Has changes, proceed
  }

  // Commit
  const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const authorString = `${author.name} <${author.email}>`;

  await execAsync(
    `git commit -m "${escapedMessage}" --author="${authorString}"`
  );

  // Get the commit SHA
  const { stdout } = await execAsync("git rev-parse HEAD");
  return stdout.trim();
}

/**
 * Delete a customer file and commit the deletion
 * @param slug - The customer slug to delete
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function deleteCustomerAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const filepath = `customers/${slug}.md`;

  // Delete file
  await deleteCustomerFile(slug);

  // Git remove
  await execAsync(`git rm "${filepath}"`);

  // Check if there are changes to commit
  try {
    await execAsync("git diff --staged --quiet");
    return null; // No changes
  } catch {
    // Has changes, proceed
  }

  // Commit
  const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const authorString = `${author.name} <${author.email}>`;

  await execAsync(
    `git commit -m "${escapedMessage}" --author="${authorString}"`
  );

  // Get the commit SHA
  const { stdout } = await execAsync("git rev-parse HEAD");
  return stdout.trim();
}

/**
 * Get git log for a customer file
 * @param slug - The customer slug
 * @param limit - Maximum number of commits to return
 * @returns Array of commit info
 */
export async function getCustomerHistory(
  slug: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  const filepath = `customers/${slug}.md`;

  try {
    const { stdout } = await execAsync(
      `git log -n ${limit} --format='%H|%an|%ae|%aI|%s' -- "${filepath}"`
    );

    if (!stdout.trim()) {
      return [];
    }

    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [sha, author, email, date, message] = line.split("|");
        return { sha, author, email, date, message };
      });
  } catch {
    // File not found or no commits
    return [];
  }
}

/**
 * Get diff between two commits for a customer file
 * @param slug - The customer slug
 * @param fromCommit - Starting commit SHA (or 'HEAD~1' for previous)
 * @param toCommit - Ending commit SHA (default: 'HEAD')
 * @returns Diff output
 */
export async function getCustomerDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  const filepath = `customers/${slug}.md`;

  try {
    const { stdout } = await execAsync(
      `git diff ${fromCommit} ${toCommit} -- "${filepath}"`
    );
    return stdout;
  } catch {
    return "";
  }
}
