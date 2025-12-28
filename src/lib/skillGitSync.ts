/**
 * Skill Git Sync (Compatibility Layer)
 *
 * Maintains the old function-based API while delegating to the new class-based service.
 * This allows existing code to continue working without changes.
 *
 * DEPRECATED: New code should use skillGitSync service directly from git-sync/skill-git-sync.service.ts
 */

import { skillGitSync } from "./git-sync/skill-git-sync.service";
import type { SkillFile } from "./skillFiles";
import type { GitAuthor } from "./gitCommitHelpers";

/**
 * Save a skill to the skills/ directory and commit to git
 * @deprecated Use skillGitSync.saveAndCommit() instead
 */
export async function saveSkillAndCommit(
  slug: string,
  skill: SkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return skillGitSync.saveAndCommit(slug, skill, commitMessage, author);
}

/**
 * Update a skill file and commit the changes
 * @deprecated Use skillGitSync.updateAndCommit() instead
 */
export async function updateSkillAndCommit(
  oldSlug: string,
  skill: SkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return skillGitSync.updateAndCommit(oldSlug, skill, commitMessage, author);
}

/**
 * Delete a skill file and commit the deletion
 * @deprecated Use skillGitSync.deleteAndCommit() instead
 */
export async function deleteSkillAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return skillGitSync.deleteAndCommit(slug, commitMessage, author);
}

/**
 * Get git log for a skill file
 * @deprecated Use skillGitSync.getHistory() instead
 */
export async function getSkillHistory(
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
  return skillGitSync.getHistory(slug, limit);
}

/**
 * Get diff between two commits for a skill file
 * @deprecated Use skillGitSync.getDiff() instead
 */
export async function getSkillDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  return skillGitSync.getDiff(slug, fromCommit, toCommit);
}

/**
 * Check if git working directory is clean
 * @deprecated Use skillGitSync.isClean() instead
 */
export async function isGitClean(): Promise<boolean> {
  return skillGitSync.isClean();
}

/**
 * Get current git branch name
 * @deprecated Use skillGitSync.getCurrentBranch() instead
 */
export async function getCurrentBranch(): Promise<string> {
  return skillGitSync.getCurrentBranch();
}

/**
 * Push commits to remote
 * @deprecated Use skillGitSync.pushToRemote() instead
 */
export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await skillGitSync.pushToRemote(remote, branch);
}

// Re-export the service for new code
export { skillGitSync };
