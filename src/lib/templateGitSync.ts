import {
  writeTemplateFile,
  getTemplateSlug,
  renameTemplateFile,
  deleteTemplateFile,
} from "./templateFiles";
import type { TemplateFile } from "./templateFiles";
import {
  gitAdd,
  gitRemove,
  commitStagedChangesIfAny,
  getFileHistory,
  isPathClean,
  GitAuthor,
} from "./gitCommitHelpers";

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
  await gitAdd(filepath);

  // 3. Commit if there are changes
  return commitStagedChangesIfAny(commitMessage, author);
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
    await gitAdd([`templates/${oldSlug}.md`, `templates/${newSlug}.md`]);
  }

  // Write updated content
  await writeTemplateFile(newSlug, template);
  await gitAdd(`templates/${newSlug}.md`);

  return commitStagedChangesIfAny(commitMessage, author);
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
  await gitRemove(filepath);

  return commitStagedChangesIfAny(commitMessage, author);
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
  return getFileHistory(filepath, limit);
}

/**
 * Check if git working directory is clean for templates
 * @returns True if no uncommitted changes in templates/
 */
export async function isTemplatesGitClean(): Promise<boolean> {
  return isPathClean("templates/");
}
