import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

/**
 * Placeholder mapping for templates
 */
export interface PlaceholderMapping {
  placeholder: string;
  source: "customer" | "skill" | "llm" | "input" | "static";
  field?: string; // For customer/skill sources
  skillCategory?: string; // For skill source
  llmInstruction?: string; // For llm source
  fallback?: string; // For input source
  value?: string; // For static source
}

/**
 * Template file format
 * Stored as markdown files with YAML frontmatter in templates/ directory
 */
export interface TemplateFile {
  id: string;
  slug: string;
  name: string;
  description?: string;
  content: string; // Markdown template with {{placeholders}}
  category?: string;
  outputFormat: "markdown" | "docx" | "pdf";
  placeholderMappings?: PlaceholderMapping[];
  instructionPresetId?: string;
  isActive: boolean;
  sortOrder: number;
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  createdBy?: string;
  updatedBy?: string;
}

// Path to templates directory (relative to project root)
const TEMPLATES_DIR = path.join(process.cwd(), "templates");

/**
 * Generate URL-safe slug from template name
 * e.g., "Sales Battlecard" -> "sales-battlecard"
 */
export function getTemplateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read a template file from the templates/ directory
 * @param slug - The template slug (filename without .md extension)
 * @returns Parsed template file data
 */
export async function readTemplateFile(slug: string): Promise<TemplateFile> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);

  try {
    const fileContent = await fs.readFile(filepath, "utf-8");
    const { data: frontmatter, content } = matter(fileContent);

    return {
      id: frontmatter.id,
      slug: frontmatter.slug || slug,
      name: frontmatter.name,
      description: frontmatter.description,
      content: content.trim(),
      category: frontmatter.category,
      outputFormat: frontmatter.outputFormat || "markdown",
      placeholderMappings: frontmatter.placeholderMappings || [],
      instructionPresetId: frontmatter.instructionPresetId,
      isActive: frontmatter.isActive !== false, // Default to true
      sortOrder: frontmatter.sortOrder || 0,
      created: frontmatter.created,
      updated: frontmatter.updated,
      createdBy: frontmatter.createdBy,
      updatedBy: frontmatter.updatedBy,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Template file not found: ${slug}.md`);
    }
    throw error;
  }
}

/**
 * Write a template file to the templates/ directory
 * @param slug - The template slug (filename without .md extension)
 * @param template - The template data to write
 */
export async function writeTemplateFile(slug: string, template: TemplateFile): Promise<void> {
  // Ensure templates directory exists
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });

  const frontmatter: Record<string, unknown> = {
    id: template.id,
    slug: template.slug || slug,
    name: template.name,
    description: template.description,
    category: template.category,
    outputFormat: template.outputFormat,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    created: template.created,
    updated: new Date().toISOString(),
    createdBy: template.createdBy,
    updatedBy: template.updatedBy,
  };

  // Add optional fields only if they have values
  if (template.instructionPresetId) {
    frontmatter.instructionPresetId = template.instructionPresetId;
  }
  if (template.placeholderMappings && template.placeholderMappings.length > 0) {
    frontmatter.placeholderMappings = template.placeholderMappings;
  }

  // Generate markdown with YAML frontmatter
  const markdown = matter.stringify(template.content, frontmatter);

  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  await fs.writeFile(filepath, markdown, "utf-8");
}

/**
 * List all template files in the templates/ directory
 * @returns Array of template slugs (filenames without .md extension)
 */
export async function listTemplateFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
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
 * Check if a template file exists
 * @param slug - The template slug to check
 * @returns True if the file exists
 */
export async function templateFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a template file from the templates/ directory
 * @param slug - The template slug to delete
 */
export async function deleteTemplateFile(slug: string): Promise<void> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  await fs.unlink(filepath);
}

/**
 * Rename a template file (when name changes)
 * @param oldSlug - Current template slug
 * @param newSlug - New template slug
 */
export async function renameTemplateFile(oldSlug: string, newSlug: string): Promise<void> {
  if (oldSlug === newSlug) return;

  const oldPath = path.join(TEMPLATES_DIR, `${oldSlug}.md`);
  const newPath = path.join(TEMPLATES_DIR, `${newSlug}.md`);

  await fs.rename(oldPath, newPath);
}
