/**
 * Prompt Modifier Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for prompt modifiers.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeModifierFile,
  deleteModifierFile,
  type PromptModifierFile,
} from "../promptFiles";

/**
 * Git sync service for prompt modifiers
 */
class PromptModifierGitSyncService extends BaseGitSyncService<PromptModifierFile> {
  protected getDirectory(): string {
    return "prompts/modifiers";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(modifier: PromptModifierFile): string {
    // Modifiers use their ID as the slug
    return modifier.id;
  }

  protected async writeFile(modifierId: string, modifier: PromptModifierFile): Promise<void> {
    await writeModifierFile(modifierId, modifier);
  }

  protected async deleteFile(modifierId: string): Promise<void> {
    await deleteModifierFile(modifierId);
  }

  protected async renameFile(oldId: string, newId: string): Promise<void> {
    // Modifiers don't typically rename - ID is stable
    throw new Error("Modifier renaming not supported - IDs should be stable");
  }
}

// Export singleton instance
export const promptModifierGitSync = new PromptModifierGitSyncService();

// Re-export types for backwards compatibility
export type { PromptModifierFile } from "../promptFiles";
export type { GitAuthor } from "../gitCommitHelpers";
