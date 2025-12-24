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
  return createSlug(name);
}

/**
 * Read a template file from the templates/ directory
 * @param slug - The template slug (filename without .md extension)
 * @returns Parsed template file data
 */
export async function readTemplateFile(slug: string): Promise<TemplateFile> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);

  const { frontmatter, content } = await readFrontmatterFile(
    filepath,
    `Template file not found: ${slug}.md`
  );

  return {
    id: frontmatter.id as string,
    slug: (frontmatter.slug as string) || slug,
    name: frontmatter.name as string,
    description: frontmatter.description as string | undefined,
    content: content.trim(),
    category: frontmatter.category as string | undefined,
    outputFormat:
      (frontmatter.outputFormat as TemplateFile["outputFormat"]) || "markdown",
    placeholderMappings:
      (frontmatter.placeholderMappings as TemplateFile["placeholderMappings"]) ||
      [],
    instructionPresetId: frontmatter.instructionPresetId as string | undefined,
    isActive: frontmatter.isActive !== false,
    sortOrder: (frontmatter.sortOrder as number) || 0,
    created: frontmatter.created as string,
    updated: frontmatter.updated as string,
    createdBy: frontmatter.createdBy as string | undefined,
    updatedBy: frontmatter.updatedBy as string | undefined,
  };
}

/**
 * Write a template file to the templates/ directory
 * @param slug - The template slug (filename without .md extension)
 * @param template - The template data to write
 */
export async function writeTemplateFile(slug: string, template: TemplateFile): Promise<void> {
  // Ensure templates directory exists
  await ensureDir(TEMPLATES_DIR);

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
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  await writeFrontmatterFile(filepath, template.content, frontmatter);
}

/**
 * List all template files in the templates/ directory
 * @returns Array of template slugs (filenames without .md extension)
 */
export async function listTemplateFiles(): Promise<string[]> {
  return listMarkdownFiles(TEMPLATES_DIR);
}

/**
 * Check if a template file exists
 * @param slug - The template slug to check
 * @returns True if the file exists
 */
export async function templateFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  return fileExists(filepath);
}

/**
 * Delete a template file from the templates/ directory
 * @param slug - The template slug to delete
 */
export async function deleteTemplateFile(slug: string): Promise<void> {
  const filepath = path.join(TEMPLATES_DIR, `${slug}.md`);
  await deleteFile(filepath);
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

  await renameFile(oldPath, newPath);
}
