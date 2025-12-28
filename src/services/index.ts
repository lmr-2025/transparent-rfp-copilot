/**
 * Service Layer - Business Logic and Data Access
 *
 * This module exports all service functions for centralized business logic.
 * Services provide a clean separation between API routes and data access,
 * making the codebase more testable and maintainable.
 *
 * Usage:
 * ```typescript
 * import { getAllSkills, createSkill } from '@/services';
 *
 * const skills = await getAllSkills();
 * const newSkill = await createSkill({ title: 'My Skill', content: '...' });
 * ```
 */

// Skills service
export {
  getAllSkills,
  getActiveSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  refreshSkillFromSources,
  applyRefreshChanges,
  searchSkills,
} from "./skills.service";

// Categories service
export {
  getAllCategories,
  getCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  getItemsByCategory,
  mergeCategories,
} from "./categories.service";

// Documents service
export {
  getAllDocuments,
  getDocumentById,
  getDocumentsByCategory,
  createDocument,
  updateDocument,
  deleteDocument,
  searchDocuments,
  getDocumentUsageStats,
  bulkUpdateDocumentCategories,
  getUncategorizedDocuments,
  getDocumentStats,
} from "./documents.service";

// Customer profiles service
export {
  getAllCustomerProfiles,
  getActiveCustomerProfiles,
  getCustomerProfileById,
  createCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile,
  searchCustomerProfiles,
  getCustomerProfileWithDocuments,
  addCustomerDocument,
  deleteCustomerDocument,
  getCustomerProfileStats,
  migrateLegacyProfile,
  bulkMigrateLegacyProfiles,
} from "./customer-profiles.service";

// Knowledge chat service (for complex chat operations)
export {
  processKnowledgeChat,
  type KnowledgeChatRequest,
  type KnowledgeChatResponse,
} from "./knowledge-chat.service";

// Type re-exports for convenience
export type { Category } from "./categories.service";
