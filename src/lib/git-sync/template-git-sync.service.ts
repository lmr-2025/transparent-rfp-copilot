/**
 * Template Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for collateral templates.
 * Replaces the old templateGitSync.ts with a class-based approach.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeTemplateFile,
  getTemplateSlug,
  renameTemplateFile,
  deleteTemplateFile,
  type TemplateFile,
} from "../templateFiles";

/**
 * Git sync service for collateral templates
 */
class TemplateGitSyncService extends BaseGitSyncService<TemplateFile> {
  protected getDirectory(): string {
    return "templates";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(template: TemplateFile): string {
    return getTemplateSlug(template.name);
  }

  protected async writeFile(slug: string, template: TemplateFile): Promise<void> {
    await writeTemplateFile(slug, template);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteTemplateFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameTemplateFile(oldSlug, newSlug);
  }
}

// Export singleton instance
export const templateGitSync = new TemplateGitSyncService();

// Re-export types for backwards compatibility
export type { TemplateFile } from "../templateFiles";
export type { GitAuthor } from "../gitCommitHelpers";
