import { exec } from "child_process";
import { promisify } from "util";
import {
  writeBlockFile,
  deleteBlockFile,
  writeModifierFile,
  deleteModifierFile,
} from "./promptFiles";
import type { PromptBlockFile, PromptModifierFile } from "./promptFiles";

const execAsync = promisify(exec);

/**
 * Git author information for commits
 */
export interface GitAuthor {
  name: string;
  email: string;
}

// ============================================
// BLOCK GIT OPERATIONS
// ============================================

/**
 * Save a prompt block to file and commit to git
 * @param blockId - The block ID (filename)
 * @param block - The block data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function saveBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // 1. Write block file
  await writeBlockFile(blockId, block);

  // 2. Git add
  const filepath = `prompts/blocks/${blockId}.md`;
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
 * Update a block file and commit the changes
 * @param blockId - The block ID
 * @param block - Updated block data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function updateBlockAndCommit(
  blockId: string,
  block: PromptBlockFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // Write updated content
  await writeBlockFile(blockId, block);
  await execAsync(`git add "prompts/blocks/${blockId}.md"`);

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
 * Delete a block file and commit the deletion
 * @param blockId - The block ID to delete
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function deleteBlockAndCommit(
  blockId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const filepath = `prompts/blocks/${blockId}.md`;

  // Delete file
  await deleteBlockFile(blockId);

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
 * Get git log for a block file
 * @param blockId - The block ID
 * @param limit - Maximum number of commits to return
 * @returns Array of commit info
 */
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
  const filepath = `prompts/blocks/${blockId}.md`;

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

// ============================================
// MODIFIER GIT OPERATIONS
// ============================================

/**
 * Save a prompt modifier to file and commit to git
 * @param modifierId - The modifier ID (filename)
 * @param modifier - The modifier data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function saveModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // 1. Write modifier file
  await writeModifierFile(modifierId, modifier);

  // 2. Git add
  const filepath = `prompts/modifiers/${modifierId}.md`;
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
 * Update a modifier file and commit the changes
 * @param modifierId - The modifier ID
 * @param modifier - Updated modifier data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function updateModifierAndCommit(
  modifierId: string,
  modifier: PromptModifierFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // Write updated content
  await writeModifierFile(modifierId, modifier);
  await execAsync(`git add "prompts/modifiers/${modifierId}.md"`);

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
 * Delete a modifier file and commit the deletion
 * @param modifierId - The modifier ID to delete
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function deleteModifierAndCommit(
  modifierId: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const filepath = `prompts/modifiers/${modifierId}.md`;

  // Delete file
  await deleteModifierFile(modifierId);

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
 * Get git log for a modifier file
 * @param modifierId - The modifier ID
 * @param limit - Maximum number of commits to return
 * @returns Array of commit info
 */
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
  const filepath = `prompts/modifiers/${modifierId}.md`;

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

// ============================================
// SHARED GIT UTILITIES
// ============================================

/**
 * Check if git working directory is clean for prompts
 * @returns True if no uncommitted changes in prompts/
 */
export async function isPromptsGitClean(): Promise<boolean> {
  try {
    await execAsync("git diff --quiet -- prompts/ && git diff --staged --quiet -- prompts/");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current git branch name
 * @returns Branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await execAsync("git branch --show-current");
  return stdout.trim();
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
  if (!branch) {
    branch = await getCurrentBranch();
  }

  await execAsync(`git push ${remote} ${branch}`);
}
