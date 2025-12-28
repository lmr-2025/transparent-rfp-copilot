/**
 * Template Git Sync (Compatibility Layer)
 *
 * Maintains the old function-based API while delegating to the new class-based service.
 * This allows existing code to continue working without changes.
 *
 * DEPRECATED: New code should use templateGitSync service directly from git-sync/template-git-sync.service.ts
 */

import { templateGitSync } from "./git-sync/template-git-sync.service";
import type { TemplateFile } from "./templateFiles";
import type { GitAuthor } from "./gitCommitHelpers";

/**
 * Save a template to the templates/ directory and commit to git
 * @deprecated Use templateGitSync.saveAndCommit() instead
 */
export async function saveTemplateAndCommit(
  slug: string,
  template: TemplateFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return templateGitSync.saveAndCommit(slug, template, commitMessage, author);
}

/**
 * Update a template file and commit the changes
 * @deprecated Use templateGitSync.updateAndCommit() instead
 */
export async function updateTemplateAndCommit(
  oldSlug: string,
  template: TemplateFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return templateGitSync.updateAndCommit(oldSlug, template, commitMessage, author);
}

/**
 * Delete a template file and commit the deletion
 * @deprecated Use templateGitSync.deleteAndCommit() instead
 */
export async function deleteTemplateAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return templateGitSync.deleteAndCommit(slug, commitMessage, author);
}

/**
 * Get git log for a template file
 * @deprecated Use templateGitSync.getHistory() instead
 */
export async function getTemplateHistory(
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
  return templateGitSync.getHistory(slug, limit);
}

/**
 * Get diff between two commits for a template file
 * @deprecated Use templateGitSync.getDiff() instead
 */
export async function getTemplateDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  return templateGitSync.getDiff(slug, fromCommit, toCommit);
}

/**
 * Check if templates directory is clean
 * @deprecated Use templateGitSync.isClean() instead
 */
export async function isTemplatesClean(): Promise<boolean> {
  return templateGitSync.isClean();
}

/**
 * Get current git branch name
 * @deprecated Use templateGitSync.getCurrentBranch() instead
 */
export async function getCurrentBranch(): Promise<string> {
  return templateGitSync.getCurrentBranch();
}

/**
 * Push commits to remote
 * @deprecated Use templateGitSync.pushToRemote() instead
 */
export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await templateGitSync.pushToRemote(remote, branch);
}

// Re-export the service for new code
export { templateGitSync };
