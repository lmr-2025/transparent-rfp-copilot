import {
  writeBlockFile,
  deleteBlockFile,
  writeModifierFile,
  deleteModifierFile,
} from "./promptFiles";
import type { PromptBlockFile, PromptModifierFile } from "./promptFiles";
import {
  gitAdd,
  gitRemove,
  commitStagedChangesIfAny,
  getFileHistory,
  isPathClean,
  getCurrentBranch as getGitCurrentBranch,
  pushToRemote as pushToGitRemote,
  GitAuthor,
} from "./gitCommitHelpers";

// ============================================
// BLOCK GIT OPERATIONS
// ============================================

export async function saveBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await writeBlockFile(blockId, block);
  await gitAdd(`prompts/blocks/${blockId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function updateBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await writeBlockFile(blockId, block);
  await gitAdd(`prompts/blocks/${blockId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function deleteBlockAndCommit(
  blockId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await deleteBlockFile(blockId);
  await gitRemove(`prompts/blocks/${blockId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function getBlockHistory(
  blockId: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  return getFileHistory(`prompts/blocks/${blockId}.md`, limit);
}

// ============================================
// MODIFIER GIT OPERATIONS
// ============================================

export async function saveModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await writeModifierFile(modifierId, modifier);
  await gitAdd(`prompts/modifiers/${modifierId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function updateModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await writeModifierFile(modifierId, modifier);
  await gitAdd(`prompts/modifiers/${modifierId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function deleteModifierAndCommit(
  modifierId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  await deleteModifierFile(modifierId);
  await gitRemove(`prompts/modifiers/${modifierId}.md`);
  return commitStagedChangesIfAny(commitMessage, author);
}

export async function getModifierHistory(
  modifierId: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  return getFileHistory(`prompts/modifiers/${modifierId}.md`, limit);
}

// ============================================
// SHARED GIT UTILITIES
// ============================================

export async function isPromptsGitClean(): Promise<boolean> {
  return isPathClean("prompts/");
}

export async function getCurrentBranch(): Promise<string> {
  return getGitCurrentBranch();
}

export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  await pushToGitRemote(remote, branch);
}
