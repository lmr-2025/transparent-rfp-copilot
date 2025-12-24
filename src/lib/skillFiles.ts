import path from "path";
import {
  createSlug,
  readFrontmatterFile,
  writeFrontmatterFile,
  listMarkdownFiles,
  fileExists,
  ensureDir,
  deleteFile,
  renameFile,
} from "./frontmatterStore";

/**
 * Skill file format - matches Anthropic-compatible skill structure
 * Stored as markdown files with YAML frontmatter in skills/ directory
 */
export interface SkillFile {
  id: string;
  slug: string;
  title: string;
  content: string; // Pure markdown content (no hardcoded Q&A)
  categories: string[];
  owners: Array<{
    name: string;
    email?: string;
    userId?: string;
  }>;
  sources: Array<{
    url: string;
    addedAt: string;
    lastFetched?: string;
  }>;
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  active: boolean;
}

// Path to skills directory (relative to project root)
const SKILLS_DIR = path.join(process.cwd(), "skills");

/**
 * Generate URL-safe slug from skill title
 * e.g., "Compliance & Certifications" -> "compliance-and-certifications"
 */
export function getSkillSlug(title: string): string {
  return createSlug(title);
}

/**
 * Read a skill file from the skills/ directory
 * @param slug - The skill slug (filename without .md extension)
 * @returns Parsed skill file data
 */
export async function readSkillFile(slug: string): Promise<SkillFile> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);

  const { frontmatter, content } = await readFrontmatterFile(
    filepath,
    `Skill file not found: ${slug}.md`
  );

  return {
    id: frontmatter.id as string,
    slug,
    title: frontmatter.title as string,
    content: content.trim(),
    categories: (frontmatter.categories as SkillFile["categories"]) || [],
    owners: (frontmatter.owners as SkillFile["owners"]) || [],
    sources: (frontmatter.sources as SkillFile["sources"]) || [],
    created: frontmatter.created as string,
    updated: frontmatter.updated as string,
    active: frontmatter.active !== false,
  };
}

/**
 * Write a skill file to the skills/ directory
 * @param slug - The skill slug (filename without .md extension)
 * @param skill - The skill data to write
 */
export async function writeSkillFile(slug: string, skill: SkillFile): Promise<void> {
  // Ensure skills directory exists
  await ensureDir(SKILLS_DIR);

  const frontmatter = {
    id: skill.id,
    title: skill.title,
    categories: skill.categories,
    created: skill.created,
    updated: new Date().toISOString(),
    owners: skill.owners,
    sources: skill.sources,
    active: skill.active,
  };

  // Generate markdown with YAML frontmatter
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  await writeFrontmatterFile(filepath, skill.content, frontmatter);
}

/**
 * List all skill files in the skills/ directory
 * @returns Array of skill slugs (filenames without .md extension)
 */
export async function listSkillFiles(): Promise<string[]> {
  return listMarkdownFiles(SKILLS_DIR);
}

/**
 * Check if a skill file exists
 * @param slug - The skill slug to check
 * @returns True if the file exists
 */
export async function skillFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  return fileExists(filepath);
}

/**
 * Delete a skill file from the skills/ directory
 * @param slug - The skill slug to delete
 */
export async function deleteSkillFile(slug: string): Promise<void> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  await deleteFile(filepath);
}

/**
 * Rename a skill file (when title changes)
 * @param oldSlug - Current skill slug
 * @param newSlug - New skill slug
 */
export async function renameSkillFile(oldSlug: string, newSlug: string): Promise<void> {
  if (oldSlug === newSlug) return;

  const oldPath = path.join(SKILLS_DIR, `${oldSlug}.md`);
  const newPath = path.join(SKILLS_DIR, `${newSlug}.md`);

  await renameFile(oldPath, newPath);
}
