/**
 * Customer Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for customer profiles.
 * Replaces the old customerGitSync.ts with a class-based approach.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeCustomerFile,
  getCustomerSlug,
  renameCustomerFile,
  deleteCustomerFile,
  type CustomerFile,
} from "../customerFiles";

/**
 * Git sync service for customer profiles
 */
class CustomerGitSyncService extends BaseGitSyncService<CustomerFile> {
  protected getDirectory(): string {
    return "customers";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(customer: CustomerFile): string {
    return getCustomerSlug(customer.name);
  }

  protected async writeFile(slug: string, customer: CustomerFile): Promise<void> {
    await writeCustomerFile(slug, customer);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteCustomerFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameCustomerFile(oldSlug, newSlug);
  }
}

// Export singleton instance
export const customerGitSync = new CustomerGitSyncService();

// Re-export types for backwards compatibility
export type { CustomerFile } from "../customerFiles";
export type { GitAuthor } from "../gitCommitHelpers";
