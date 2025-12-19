import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

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
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read a skill file from the skills/ directory
 * @param slug - The skill slug (filename without .md extension)
 * @returns Parsed skill file data
 */
export async function readSkillFile(slug: string): Promise<SkillFile> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);

  try {
    const fileContent = await fs.readFile(filepath, "utf-8");
    const { data: frontmatter, content } = matter(fileContent);

    return {
      id: frontmatter.id,
      slug,
      title: frontmatter.title,
      content: content.trim(),
      categories: frontmatter.categories || [],
      owners: frontmatter.owners || [],
      sources: frontmatter.sources || [],
      created: frontmatter.created,
      updated: frontmatter.updated,
      active: frontmatter.active !== false, // Default to true
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Skill file not found: ${slug}.md`);
    }
    throw error;
  }
}

/**
 * Write a skill file to the skills/ directory
 * @param slug - The skill slug (filename without .md extension)
 * @param skill - The skill data to write
 */
export async function writeSkillFile(slug: string, skill: SkillFile): Promise<void> {
  // Ensure skills directory exists
  await fs.mkdir(SKILLS_DIR, { recursive: true });

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
  const markdown = matter.stringify(skill.content, frontmatter);

  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  await fs.writeFile(filepath, markdown, "utf-8");
}

/**
 * List all skill files in the skills/ directory
 * @returns Array of skill slugs (filenames without .md extension)
 */
export async function listSkillFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(SKILLS_DIR);
    return files
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .map((file) => file.replace(/\.md$/, ""));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []; // Directory doesn't exist yet
    }
    throw error;
  }
}

/**
 * Check if a skill file exists
 * @param slug - The skill slug to check
 * @returns True if the file exists
 */
export async function skillFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a skill file from the skills/ directory
 * @param slug - The skill slug to delete
 */
export async function deleteSkillFile(slug: string): Promise<void> {
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  await fs.unlink(filepath);
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

  await fs.rename(oldPath, newPath);
}
