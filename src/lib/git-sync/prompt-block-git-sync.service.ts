/**
 * Prompt Block Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for prompt blocks.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeBlockFile,
  deleteBlockFile,
  type PromptBlockFile,
} from "../promptFiles";

/**
 * Git sync service for prompt blocks
 */
class PromptBlockGitSyncService extends BaseGitSyncService<PromptBlockFile> {
  protected getDirectory(): string {
    return "prompts/blocks";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(block: PromptBlockFile): string {
    // Blocks use their ID as the slug
    return block.id;
  }

  protected async writeFile(blockId: string, block: PromptBlockFile): Promise<void> {
    await writeBlockFile(blockId, block);
  }

  protected async deleteFile(blockId: string): Promise<void> {
    await deleteBlockFile(blockId);
  }

  protected async renameFile(oldId: string, newId: string): Promise<void> {
    // Blocks don't typically rename - ID is stable
    // If needed, implement as delete old + write new
    throw new Error("Block renaming not supported - IDs should be stable");
  }
}

// Export singleton instance
export const promptBlockGitSync = new PromptBlockGitSyncService();

// Re-export types for backwards compatibility
export type { PromptBlockFile } from "../promptFiles";
export type { GitAuthor } from "../gitCommitHelpers";
