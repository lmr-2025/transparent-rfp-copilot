/**
 * Prompt Git Sync (Compatibility Layer)
 *
 * Maintains the old function-based API while delegating to the new class-based services.
 * Handles both blocks and modifiers.
 *
 * DEPRECATED: New code should use promptBlockGitSync and promptModifierGitSync services directly
 */

import { promptBlockGitSync } from "./git-sync/prompt-block-git-sync.service";
import { promptModifierGitSync } from "./git-sync/prompt-modifier-git-sync.service";
import type { PromptBlockFile, PromptModifierFile } from "./promptFiles";
import type { GitAuthor } from "./gitCommitHelpers";

// ============================================
// BLOCK GIT OPERATIONS
// ============================================

/**
 * @deprecated Use promptBlockGitSync.saveAndCommit() instead
 */
export async function saveBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptBlockGitSync.saveAndCommit(blockId, block, commitMessage, author);
}

/**
 * @deprecated Use promptBlockGitSync.updateAndCommit() instead
 */
export async function updateBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptBlockGitSync.updateAndCommit(blockId, block, commitMessage, author);
}

/**
 * @deprecated Use promptBlockGitSync.deleteAndCommit() instead
 */
export async function deleteBlockAndCommit(
  blockId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptBlockGitSync.deleteAndCommit(blockId, commitMessage, author);
}

/**
 * @deprecated Use promptBlockGitSync.getHistory() instead
 */
export async function getBlockHistory(
  blockId: string,
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
  return promptBlockGitSync.getHistory(blockId, limit);
}

// ============================================
// MODIFIER GIT OPERATIONS
// ============================================

/**
 * @deprecated Use promptModifierGitSync.saveAndCommit() instead
 */
export async function saveModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptModifierGitSync.saveAndCommit(modifierId, modifier, commitMessage, author);
}

/**
 * @deprecated Use promptModifierGitSync.updateAndCommit() instead
 */
export async function updateModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptModifierGitSync.updateAndCommit(modifierId, modifier, commitMessage, author);
}

/**
 * @deprecated Use promptModifierGitSync.deleteAndCommit() instead
 */
export async function deleteModifierAndCommit(
  modifierId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return promptModifierGitSync.deleteAndCommit(modifierId, commitMessage, author);
}

/**
 * @deprecated Use promptModifierGitSync.getHistory() instead
 */
export async function getModifierHistory(
  modifierId: string,
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
  return promptModifierGitSync.getHistory(modifierId, limit);
}

// ============================================
// SHARED OPERATIONS
// ============================================

/**
 * @deprecated Use promptBlockGitSync.isClean() or promptModifierGitSync.isClean() instead
 */
export async function isPromptsClean(): Promise<boolean> {
  return promptBlockGitSync.isClean();
}

/**
 * @deprecated Use promptBlockGitSync.getCurrentBranch() instead
 */
export async function getCurrentBranch(): Promise<string> {
  return promptBlockGitSync.getCurrentBranch();
}

/**
 * @deprecated Use promptBlockGitSync.pushToRemote() instead
 */
export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await promptBlockGitSync.pushToRemote(remote, branch);
}

// Re-export the services for new code
export { promptBlockGitSync, promptModifierGitSync };
