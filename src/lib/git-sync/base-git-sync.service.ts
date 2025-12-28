/**
 * Base Git Sync Service
 *
 * Abstract base class for git-synced entities (Skills, Customers, Prompts, Templates).
 * Provides common git operations (save, update, delete, history) with entity-specific
 * customization through abstract methods.
 *
 * This eliminates ~400 lines of duplicate code across 4 git sync implementations.
 */

import {
  gitAdd,
  gitRemove,
  commitStagedChangesIfAny,
  getFileHistory,
  getFileDiff,
  isRepoClean,
  getCurrentBranch as getGitCurrentBranch,
  pushToRemote as pushToGitRemote,
  GitAuthor,
} from "../gitCommitHelpers";

export interface GitCommitInfo {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

/**
 * Abstract base class for git-synced entities
 * @template T - The entity file type (e.g., SkillFile, CustomerFile)
 */
export abstract class BaseGitSyncService<T> {
  /**
   * Get the directory name for this entity type
   * @example "skills", "customers", "prompts", "templates"
   */
  protected abstract getDirectory(): string;

  /**
   * Get the file extension for this entity type
   * @example "md", "json"
   */
  protected abstract getFileExtension(): string;

  /**
   * Generate a slug (filename without extension) from the entity
   * @param entity - The entity data
   * @returns Slug string (e.g., "customer-onboarding-process")
   */
  protected abstract generateSlug(entity: T): string;

  /**
   * Write the entity to a file
   * @param slug - The filename slug
   * @param entity - The entity data
   */
  protected abstract writeFile(slug: string, entity: T): Promise<void>;

  /**
   * Delete the entity file
   * @param slug - The filename slug
   */
  protected abstract deleteFile(slug: string): Promise<void>;

  /**
   * Rename the entity file
   * @param oldSlug - Current filename slug
   * @param newSlug - New filename slug
   */
  protected abstract renameFile(oldSlug: string, newSlug: string): Promise<void>;

  /**
   * Get the full file path for an entity
   * @param slug - The filename slug
   * @returns Full relative path (e.g., "skills/onboarding.md")
   */
  protected getFilePath(slug: string): string {
    return `${this.getDirectory()}/${slug}.${this.getFileExtension()}`;
  }

  /**
   * Save an entity to file and commit to git
   * @param slug - The filename slug
   * @param entity - The entity data
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async saveAndCommit(
    slug: string,
    entity: T,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    // 1. Write entity file
    await this.writeFile(slug, entity);

    // 2. Git add
    const filepath = this.getFilePath(slug);
    await gitAdd(filepath);

    // 3. Commit if there are changes
    return commitStagedChangesIfAny(commitMessage, author);
  }

  /**
   * Update an entity file and commit the changes
   * Handles slug changes (renames) automatically
   * @param oldSlug - Current filename slug (may be different if name/title changed)
   * @param entity - Updated entity data
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async updateAndCommit(
    oldSlug: string,
    entity: T,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    const newSlug = this.generateSlug(entity);

    // If slug changed (name/title changed), rename the file
    if (oldSlug !== newSlug) {
      await this.renameFile(oldSlug, newSlug);
      await gitAdd([this.getFilePath(oldSlug), this.getFilePath(newSlug)]);
    }

    // Write updated content
    await this.writeFile(newSlug, entity);
    await gitAdd(this.getFilePath(newSlug));

    return commitStagedChangesIfAny(commitMessage, author);
  }

  /**
   * Delete an entity file and commit the deletion
   * @param slug - The filename slug to delete
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async deleteAndCommit(
    slug: string,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    const filepath = this.getFilePath(slug);

    // Delete file
    await this.deleteFile(slug);

    // Git remove
    await gitRemove(filepath);

    return commitStagedChangesIfAny(commitMessage, author);
  }

  /**
   * Get git log for an entity file
   * @param slug - The filename slug
   * @param limit - Maximum number of commits to return
   * @returns Array of commit info
   */
  async getHistory(slug: string, limit = 10): Promise<GitCommitInfo[]> {
    const filepath = this.getFilePath(slug);
    return getFileHistory(filepath, limit);
  }

  /**
   * Get diff between two commits for an entity file
   * @param slug - The filename slug
   * @param fromCommit - Starting commit SHA (or 'HEAD~1' for previous)
   * @param toCommit - Ending commit SHA (default: 'HEAD')
   * @returns Diff output
   */
  async getDiff(
    slug: string,
    fromCommit: string,
    toCommit = "HEAD"
  ): Promise<string> {
    const filepath = this.getFilePath(slug);
    return getFileDiff(filepath, fromCommit, toCommit);
  }

  /**
   * Check if git working directory is clean
   * @returns True if no uncommitted changes
   */
  async isClean(): Promise<boolean> {
    return isRepoClean();
  }

  /**
   * Get current git branch name
   * @returns Branch name
   */
  async getCurrentBranch(): Promise<string> {
    return getGitCurrentBranch();
  }

  /**
   * Push commits to remote
   * @param remote - Remote name (default: 'origin')
   * @param branch - Branch name (default: current branch)
   */
  async pushToRemote(remote = "origin", branch?: string): Promise<void> {
    await pushToGitRemote(remote, branch);
  }
}
