/**
 * Skill Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for skills.
 * Replaces the old skillGitSync.ts with a class-based approach.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeSkillFile,
  getSkillSlug,
  renameSkillFile,
  deleteSkillFile,
  type SkillFile,
} from "../skillFiles";

/**
 * Git sync service for skills
 */
class SkillGitSyncService extends BaseGitSyncService<SkillFile> {
  protected getDirectory(): string {
    return "skills";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(skill: SkillFile): string {
    return getSkillSlug(skill.title);
  }

  protected async writeFile(slug: string, skill: SkillFile): Promise<void> {
    await writeSkillFile(slug, skill);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteSkillFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameSkillFile(oldSlug, newSlug);
  }
}

// Export singleton instance
export const skillGitSync = new SkillGitSyncService();

// Re-export types for backwards compatibility
export type { SkillFile } from "../skillFiles";
export type { GitAuthor } from "../gitCommitHelpers";
