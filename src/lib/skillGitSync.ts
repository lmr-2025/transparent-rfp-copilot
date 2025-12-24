import { exec } from "child_process";
import { promisify } from "util";
import { writeSkillFile, getSkillSlug, renameSkillFile, deleteSkillFile } from "./skillFiles";
import type { SkillFile } from "./skillFiles";

const execAsync = promisify(exec);

/**
 * Git author information for commits
 */
export interface GitAuthor {
  name: string;
  email: string;
}

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
    await execAsync(`git add "skills/${oldSlug}.md" "skills/${newSlug}.md"`);
  }

  // Write updated content
  await writeSkillFile(newSlug, skill);
  await execAsync(`git add "skills/${newSlug}.md"`);

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

  try {
    const { stdout } = await execAsync(
      `git diff ${fromCommit} ${toCommit} -- "${filepath}"`
    );
    return stdout;
  } catch {
    return "";
  }
}

/**
 * Check if git working directory is clean
 * @returns True if no uncommitted changes
 */
export async function isGitClean(): Promise<boolean> {
  try {
    await execAsync("git diff --quiet && git diff --staged --quiet");
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
