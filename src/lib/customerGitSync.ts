/**
 * Customer Git Sync (Compatibility Layer)
 *
 * Maintains the old function-based API while delegating to the new class-based service.
 * This allows existing code to continue working without changes.
 *
 * DEPRECATED: New code should use customerGitSync service directly from git-sync/customer-git-sync.service.ts
 */

import { customerGitSync } from "./git-sync/customer-git-sync.service";
import type { CustomerFile } from "./customerFiles";
import type { GitAuthor } from "./gitCommitHelpers";

/**
 * Save a customer to the customers/ directory and commit to git
 * @deprecated Use customerGitSync.saveAndCommit() instead
 */
export async function saveCustomerAndCommit(
  slug: string,
  customer: CustomerFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return customerGitSync.saveAndCommit(slug, customer, commitMessage, author);
}

/**
 * Update a customer file and commit the changes
 * @deprecated Use customerGitSync.updateAndCommit() instead
 */
export async function updateCustomerAndCommit(
  oldSlug: string,
  customer: CustomerFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return customerGitSync.updateAndCommit(oldSlug, customer, commitMessage, author);
}

/**
 * Delete a customer file and commit the deletion
 * @deprecated Use customerGitSync.deleteAndCommit() instead
 */
export async function deleteCustomerAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return customerGitSync.deleteAndCommit(slug, commitMessage, author);
}

/**
 * Get git log for a customer file
 * @deprecated Use customerGitSync.getHistory() instead
 */
export async function getCustomerHistory(
  slug: string,
  limit = 10
): Promise<
  Array<{
    sha: string;
    author: string;
    email: string;
    date: string;
    message: string;
  }>
> {
  return customerGitSync.getHistory(slug, limit);
}

/**
 * Get diff between two commits for a customer file
 * @deprecated Use customerGitSync.getDiff() instead
 */
export async function getCustomerDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  return customerGitSync.getDiff(slug, fromCommit, toCommit);
}

/**
 * Check if git working directory is clean
 * @deprecated Use customerGitSync.isClean() instead
 */
export async function isGitClean(): Promise<boolean> {
  return customerGitSync.isClean();
}

/**
 * Get current git branch name
 * @deprecated Use customerGitSync.getCurrentBranch() instead
 */
export async function getCurrentBranch(): Promise<string> {
  return customerGitSync.getCurrentBranch();
}

/**
 * Push commits to remote
 * @deprecated Use customerGitSync.pushToRemote() instead
 */
export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await customerGitSync.pushToRemote(remote, branch);
}

// Re-export the service for new code
export { customerGitSync };

// Re-export GitAuthor interface for backwards compatibility
export type { GitAuthor };
