import { writeSkillFile, getSkillSlug, renameSkillFile, deleteSkillFile } from "./skillFiles";
import type { SkillFile } from "./skillFiles";
import {
  gitAdd,
  gitRemove,
  commitStagedChangesIfAny,
  getFileHistory,
  getFileDiff,
  isRepoClean,
  getCurrentBranch as getGitCurrentBranch,
  pushToRemote as pushToGitRemote,
  GitAuthor,
} from "./gitCommitHelpers";

/**
 * Save a skill to the skills/ directory and commit to git
 * @param slug - The skill slug (filename)
 * @param skill - The skill data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function saveSkillAndCommit(
  slug: string,
  skill: SkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // 1. Write skill file
  await writeSkillFile(slug, skill);

  // 2. Git add
  const filepath = `skills/${slug}.md`;
  await gitAdd(filepath);

  // 3. Commit if there are changes
  return commitStagedChangesIfAny(commitMessage, author);
}

/**
 * Update a skill file and commit the changes
 * Handles slug changes (renames) automatically
 * @param oldSlug - Current skill slug (may be different if title changed)
 * @param skill - Updated skill data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function updateSkillAndCommit(
  oldSlug: string,
  skill: SkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const newSlug = getSkillSlug(skill.title);

  // If slug changed (title changed), rename the file
  if (oldSlug !== newSlug) {
    await renameSkillFile(oldSlug, newSlug);
    await gitAdd([`skills/${oldSlug}.md`, `skills/${newSlug}.md`]);
  }

  // Write updated content
  await writeSkillFile(newSlug, skill);
  await gitAdd(`skills/${newSlug}.md`);

  return commitStagedChangesIfAny(commitMessage, author);
}

/**
 * Delete a skill file and commit the deletion
 * @param slug - The skill slug to delete
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function deleteSkillAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const filepath = `skills/${slug}.md`;

  // Delete file
  await deleteSkillFile(slug);

  // Git remove
  await gitRemove(filepath);

  return commitStagedChangesIfAny(commitMessage, author);
}

/**
 * Get git log for a skill file
 * @param slug - The skill slug
 * @param limit - Maximum number of commits to return
 * @returns Array of commit info
 */
export async function getSkillHistory(
  slug: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  const filepath = `skills/${slug}.md`;
  return getFileHistory(filepath, limit);
}

/**
 * Get diff between two commits for a skill file
 * @param slug - The skill slug
 * @param fromCommit - Starting commit SHA (or 'HEAD~1' for previous)
 * @param toCommit - Ending commit SHA (default: 'HEAD')
 * @returns Diff output
 */
export async function getSkillDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  const filepath = `skills/${slug}.md`;
  return getFileDiff(filepath, fromCommit, toCommit);
}

/**
 * Check if git working directory is clean
 * @returns True if no uncommitted changes
 */
export async function isGitClean(): Promise<boolean> {
  return isRepoClean();
}

/**
 * Get current git branch name
 * @returns Branch name
 */
export async function getCurrentBranch(): Promise<string> {
  return getGitCurrentBranch();
}

/**
 * Push commits to remote
 * @param remote - Remote name (default: 'origin')
 * @param branch - Branch name (default: current branch)
 */
export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await pushToGitRemote(remote, branch);
}
