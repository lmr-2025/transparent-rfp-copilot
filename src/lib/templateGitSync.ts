import { exec } from "child_process";
import { promisify } from "util";
import {
  writeTemplateFile,
  getTemplateSlug,
  renameTemplateFile,
  deleteTemplateFile,
} from "./templateFiles";
import type { TemplateFile } from "./templateFiles";

const execAsync = promisify(exec);

/**
 * Git author information for commits
 */
export interface GitAuthor {
  name: string;
  email: string;
}

/**
 * Save a template to the templates/ directory and commit to git
 * @param slug - The template slug (filename)
 * @param template - The template data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function saveTemplateAndCommit(
  slug: string,
  template: TemplateFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  // 1. Write template file
  await writeTemplateFile(slug, template);

  // 2. Git add
  const filepath = `templates/${slug}.md`;
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
 * Update a template file and commit the changes
 * Handles slug changes (renames) automatically
 * @param oldSlug - Current template slug (may be different if name changed)
 * @param template - Updated template data
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function updateTemplateAndCommit(
  oldSlug: string,
  template: TemplateFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const newSlug = getTemplateSlug(template.name);

  // If slug changed (name changed), rename the file
  if (oldSlug !== newSlug) {
    await renameTemplateFile(oldSlug, newSlug);
    await execAsync(`git add "templates/${oldSlug}.md" "templates/${newSlug}.md"`);
  }

  // Write updated content
  await writeTemplateFile(newSlug, template);
  await execAsync(`git add "templates/${newSlug}.md"`);

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
 * Delete a template file and commit the deletion
 * @param slug - The template slug to delete
 * @param commitMessage - Git commit message
 * @param author - Git author info
 * @returns Git commit SHA if a commit was created, null if no changes
 */
export async function deleteTemplateAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  const filepath = `templates/${slug}.md`;

  // Delete file
  await deleteTemplateFile(slug);

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
 * Get git log for a template file
 * @param slug - The template slug
 * @param limit - Maximum number of commits to return
 * @returns Array of commit info
 */
export async function getTemplateHistory(
  slug: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  const filepath = `templates/${slug}.md`;

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
 * Check if git working directory is clean for templates
 * @returns True if no uncommitted changes in templates/
 */
export async function isTemplatesGitClean(): Promise<boolean> {
  try {
    await execAsync("git diff --quiet -- templates/ && git diff --staged --quiet -- templates/");
    return true;
  } catch {
    return false;
  }
}
