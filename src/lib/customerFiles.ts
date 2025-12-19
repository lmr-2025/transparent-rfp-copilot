import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

/**
 * Customer profile file format - stored as markdown files with YAML frontmatter
 * in customers/ directory
 */
export interface CustomerFile {
  id: string;
  slug: string;
  name: string;
  content: string; // Main profile content (markdown)

  // Company metadata
  industry?: string;
  website?: string;

  // Salesforce fields (read-only in app, synced from Salesforce)
  salesforceId?: string;
  region?: string;
  tier?: string;
  employeeCount?: number;
  annualRevenue?: number;
  accountType?: string;
  billingLocation?: string;
  lastSalesforceSync?: string;

  // Ownership and sources
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
  documents?: Array<{
    id: string;
    filename: string;
    uploadedAt: string;
  }>;

  // Special considerations (like edge cases for skills)
  considerations: string[];

  // Timestamps
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  active: boolean;
}

// Path to customers directory (relative to project root)
const CUSTOMERS_DIR = path.join(process.cwd(), "customers");

/**
 * Generate URL-safe slug from customer name
 * e.g., "Acme Corporation" -> "acme-corporation"
 */
export function getCustomerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read a customer file from the customers/ directory
 * @param slug - The customer slug (filename without .md extension)
 * @returns Parsed customer file data
 */
export async function readCustomerFile(slug: string): Promise<CustomerFile> {
  const filepath = path.join(CUSTOMERS_DIR, `${slug}.md`);

  try {
    const fileContent = await fs.readFile(filepath, "utf-8");
    const { data: frontmatter, content } = matter(fileContent);

    return {
      id: frontmatter.id,
      slug,
      name: frontmatter.name,
      content: content.trim(),
      industry: frontmatter.industry,
      website: frontmatter.website,
      salesforceId: frontmatter.salesforceId,
      region: frontmatter.region,
      tier: frontmatter.tier,
      employeeCount: frontmatter.employeeCount,
      annualRevenue: frontmatter.annualRevenue,
      accountType: frontmatter.accountType,
      billingLocation: frontmatter.billingLocation,
      lastSalesforceSync: frontmatter.lastSalesforceSync,
      owners: frontmatter.owners || [],
      sources: frontmatter.sources || [],
      documents: frontmatter.documents,
      considerations: frontmatter.considerations || [],
      created: frontmatter.created,
      updated: frontmatter.updated,
      active: frontmatter.active !== false, // Default to true
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Customer file not found: ${slug}.md`);
    }
    throw error;
  }
}

/**
 * Write a customer file to the customers/ directory
 * @param slug - The customer slug (filename without .md extension)
 * @param customer - The customer data to write
 */
export async function writeCustomerFile(slug: string, customer: CustomerFile): Promise<void> {
  // Ensure customers directory exists
  await fs.mkdir(CUSTOMERS_DIR, { recursive: true });

  const frontmatter: Record<string, unknown> = {
    id: customer.id,
    name: customer.name,
    industry: customer.industry,
    website: customer.website,
    created: customer.created,
    updated: new Date().toISOString(),
    owners: customer.owners,
    sources: customer.sources,
    considerations: customer.considerations,
    active: customer.active,
  };

  // Only include Salesforce fields if they have values
  if (customer.salesforceId) frontmatter.salesforceId = customer.salesforceId;
  if (customer.region) frontmatter.region = customer.region;
  if (customer.tier) frontmatter.tier = customer.tier;
  if (customer.employeeCount) frontmatter.employeeCount = customer.employeeCount;
  if (customer.annualRevenue) frontmatter.annualRevenue = customer.annualRevenue;
  if (customer.accountType) frontmatter.accountType = customer.accountType;
  if (customer.billingLocation) frontmatter.billingLocation = customer.billingLocation;
  if (customer.lastSalesforceSync) frontmatter.lastSalesforceSync = customer.lastSalesforceSync;
  if (customer.documents && customer.documents.length > 0) {
    frontmatter.documents = customer.documents;
  }

  // Generate markdown with YAML frontmatter
  const markdown = matter.stringify(customer.content, frontmatter);

  const filepath = path.join(CUSTOMERS_DIR, `${slug}.md`);
  await fs.writeFile(filepath, markdown, "utf-8");
}

/**
 * List all customer files in the customers/ directory
 * @returns Array of customer slugs (filenames without .md extension)
 */
export async function listCustomerFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(CUSTOMERS_DIR);
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
 * Check if a customer file exists
 * @param slug - The customer slug to check
 * @returns True if the file exists
 */
export async function customerFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(CUSTOMERS_DIR, `${slug}.md`);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a customer file from the customers/ directory
 * @param slug - The customer slug to delete
 */
export async function deleteCustomerFile(slug: string): Promise<void> {
  const filepath = path.join(CUSTOMERS_DIR, `${slug}.md`);
  await fs.unlink(filepath);
}

/**
 * Rename a customer file (when name changes)
 * @param oldSlug - Current customer slug
 * @param newSlug - New customer slug
 */
export async function renameCustomerFile(oldSlug: string, newSlug: string): Promise<void> {
  if (oldSlug === newSlug) return;

  const oldPath = path.join(CUSTOMERS_DIR, `${oldSlug}.md`);
  const newPath = path.join(CUSTOMERS_DIR, `${newSlug}.md`);

  await fs.rename(oldPath, newPath);
}
