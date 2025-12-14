import { z } from "zod";

// Export schema type for factory
export type ValidationSchema<T> = z.ZodSchema<T>;

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Source URL schema - can be either a string URL or a SourceUrl object
const sourceUrlItemSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url(),
    addedAt: z.string(),
    lastFetchedAt: z.string().optional(),
  }),
]);

// Quick fact schema - can be string (legacy) or object
const quickFactSchema = z.union([
  z.string(),
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
]);

// Skill owner schema
const skillOwnerSchema = z.object({
  userId: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
  image: z.string().optional(),
});

// History entry schema
const historyEntrySchema = z.object({
  date: z.string(),
  action: z.string(),
  summary: z.string(),
  user: z.string().optional(),
});

// Skill schemas
export const createSkillSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required").max(100000),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  quickFacts: z.array(quickFactSchema).default([]),
  edgeCases: z.array(z.string()).default([]),
  sourceUrls: z.array(sourceUrlItemSchema).default([]),
  isActive: z.boolean().default(true),
  createdBy: z.string().optional(),
  owners: z.array(skillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
});

// For updates, we use a separate schema without defaults
// This ensures that missing fields remain undefined (not updated)
// rather than being set to default values which would overwrite existing data
export const updateSkillSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  quickFacts: z.array(quickFactSchema).optional(),
  edgeCases: z.array(z.string()).optional(),
  sourceUrls: z.array(sourceUrlItemSchema).optional(),
  isActive: z.boolean().optional(),
  createdBy: z.string().optional(),
  owners: z.array(skillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
  lastRefreshedAt: z.string().optional(),
});

// Customer profile schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  industry: z.string().max(100).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  overview: z.string().min(1, "Overview is required").max(50000),
  products: z.string().max(50000).nullable().optional(),
  challenges: z.string().max(50000).nullable().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  owners: z.string().nullable().optional(),
  salesforceId: z.string().optional(),
});

// For updates, use a separate schema without defaults
// This ensures that missing fields remain undefined (not updated)
export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(100).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  overview: z.string().min(1).max(50000).optional(),
  products: z.string().max(50000).nullable().optional(),
  challenges: z.string().max(50000).nullable().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  sourceUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  owners: z.string().nullable().optional(),
  salesforceId: z.string().optional(),
});

// Project row schema
const conversationMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const usedSkillSchema = z.union([
  z.string(),
  z.object({ id: z.string(), title: z.string() }),
]);

const projectRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  question: z.string().min(1, "Question is required"),
  response: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  conversationHistory: z.array(conversationMessageSchema).optional(),
  confidence: z.string().optional(),
  sources: z.string().optional(),
  reasoning: z.string().optional(),
  inference: z.string().optional(),
  remarks: z.string().optional(),
  usedSkills: z.array(usedSkillSchema).optional(),
  showRecommendation: z.boolean().optional(),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  sheetName: z.string().min(1, "Sheet name is required").max(200),
  columns: z.array(z.string()),
  rows: z.array(projectRowSchema),
  ownerName: z.string().max(200).optional(),
  customerName: z.string().max(200).optional(),
  notes: z.string().max(10000).optional(),
  status: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// Document schemas
export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().int().min(0).optional(),
  tags: z.array(z.string()).default([]),
});

// Reference URL schemas
export const createReferenceUrlSchema = z.object({
  url: z.string().url("Valid URL is required"),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  categories: z.array(z.string()).default([]),
});

export const bulkImportUrlsSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url("Valid URL is required"),
    title: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    categories: z.array(z.string()).optional(),
  })),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Contract schemas
export const createContractSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().int().min(0).optional(),
  customerId: z.string().uuid().optional(),
});

// Chat schemas - simple chat route
export const simpleChatSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1, "messages array is required"),
  systemPrompt: z.string().optional(),
});

// Chat schemas - knowledge chat route
const skillContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
});

const customerProfileContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional(),
  overview: z.string(),
  products: z.string().optional(),
  challenges: z.string().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })),
});

const referenceUrlContextSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
});

const chatMessageItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  defaultText: z.string(),
  text: z.string(),
  enabled: z.boolean(),
});

export const knowledgeChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(50000),
  skills: z.array(skillContextSchema).default([]),
  customerProfiles: z.array(customerProfileContextSchema).optional(),
  documentIds: z.array(z.string()).optional(),
  referenceUrls: z.array(referenceUrlContextSchema).optional(),
  conversationHistory: z.array(chatMessageItemSchema).optional(),
  chatSections: z.array(chatSectionSchema).optional(),
  userInstructions: z.string().max(50000).optional(), // User-facing behavior/persona instructions
});

// Legacy chat message schema (for other uses)
export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(50000),
  customerId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  skillIds: z.array(z.string()).optional(),
  urlIds: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
});

// Question answer schema
export const questionAnswerSchema = z.object({
  question: z.string().min(1, "Question is required").max(10000),
  prompt: z.string().max(50000).optional(),
  skills: z.array(z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()),
  })).optional(),
  fallbackContent: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
  })).optional(),
  // Dynamic prompt options
  mode: z.enum(["single", "bulk"]).optional(),
  domains: z.array(z.enum(["technical", "legal", "security"])).optional(),
});

// Helper to validate and return typed result
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Zod v4 uses issues instead of errors
    const issues = result.error.issues || [];
    const firstIssue = issues[0];
    return {
      success: false,
      error: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid input",
    };
  }
  return { success: true, data: result.data };
}
