// Chat Prompt Library - Pre-built and user-saved prompts for the Chat with Knowledge feature

// Built-in category IDs (for type safety with built-in prompts)
export type BuiltInCategoryId = "rfp" | "sales" | "marketing" | "customer" | "internal" | "custom";

export type ChatPrompt = {
  id: string;
  title: string;
  prompt: string;
  category: string; // Can be built-in or custom category ID
  isBuiltIn: boolean;
  createdAt: string;
};

// Pre-built prompts that ship with the app - focused on GTM collateral
export const builtInPrompts: ChatPrompt[] = [
  // RFP/Security Questionnaire prompts
  {
    id: "builtin-rfp-soc2",
    title: "SOC 2 questionnaire responses",
    prompt: "Help me answer SOC 2 related questions. For each Trust Service Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy), provide clear, professional responses based on our documented controls.",
    category: "rfp",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-rfp-vendor-assessment",
    title: "Vendor security assessment",
    prompt: "I'm filling out a vendor security assessment. Help me provide comprehensive answers about our security practices, certifications, and compliance posture. Be specific and cite our documented controls.",
    category: "rfp",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-rfp-data-handling",
    title: "Data handling questionnaire",
    prompt: "Help me answer questions about how we handle customer data. Include data classification, encryption, retention, disposal, and privacy practices based on our knowledge base.",
    category: "rfp",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-rfp-subprocessors",
    title: "Subprocessor & third-party questions",
    prompt: "Help me respond to questions about our subprocessors and third-party vendors. Include our vendor management practices, due diligence process, and monitoring procedures.",
    category: "rfp",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },

  // Sales enablement prompts
  {
    id: "builtin-sales-objection-security",
    title: "Handle security objections",
    prompt: "A prospect is concerned about our security posture. Help me craft a response that addresses common security concerns, highlights our certifications, and emphasizes our commitment to security. Make it conversational but professional.",
    category: "sales",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-sales-competitive",
    title: "Security competitive positioning",
    prompt: "Help me position our security and compliance capabilities competitively. What are our strongest security differentiators based on the knowledge base? Format as talking points for sales calls.",
    category: "sales",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-sales-exec-summary",
    title: "Executive security summary",
    prompt: "Create an executive-level summary of our security program for a C-suite audience. Focus on business outcomes, certifications, and trust. Keep it to 5-7 bullet points that convey confidence without technical jargon.",
    category: "sales",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-sales-enterprise-ready",
    title: "Enterprise readiness pitch",
    prompt: "Help me demonstrate that we're enterprise-ready. Cover our security certifications, compliance frameworks, SLAs, data residency options, and enterprise features based on our knowledge base.",
    category: "sales",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },

  // Marketing content prompts
  {
    id: "builtin-marketing-trust-page",
    title: "Trust/security page content",
    prompt: "Help me write content for our public trust or security page. Summarize our security practices, certifications, and commitments in a way that builds customer confidence. Use clear, accessible language.",
    category: "marketing",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-marketing-blog-security",
    title: "Security blog post draft",
    prompt: "Help me draft a blog post about our security practices. Focus on a specific area from our knowledge base and make it educational and thought-leadership oriented. Include specific examples from our documentation.",
    category: "marketing",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-marketing-one-pager",
    title: "Security one-pager",
    prompt: "Create a security one-pager I can share with prospects. Include our key certifications, security highlights, and compliance coverage. Format with headers and bullet points for easy scanning.",
    category: "marketing",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },

  // Customer success prompts
  {
    id: "builtin-customer-onboarding",
    title: "Security onboarding overview",
    prompt: "Help me explain our security practices to a new customer during onboarding. Cover the key security features they should know about, how their data is protected, and what they can expect from us.",
    category: "customer",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-customer-incident-response",
    title: "Explain incident response process",
    prompt: "A customer is asking about our incident response procedures. Help me explain our process clearly, including how we detect issues, communicate with customers, and remediate problems.",
    category: "customer",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-customer-audit-request",
    title: "Respond to audit request",
    prompt: "A customer is requesting security documentation for their audit. Help me respond professionally and outline what documentation we can provide (SOC 2 report, penetration test summaries, policies, etc.).",
    category: "customer",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },

  // Internal/operations prompts
  {
    id: "builtin-internal-gap-analysis",
    title: "Documentation gap analysis",
    prompt: "Analyze our knowledge base for gaps. What security topics or controls appear to be missing or under-documented compared to common frameworks like SOC 2, ISO 27001, or NIST?",
    category: "internal",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-internal-policy-review",
    title: "Policy consistency check",
    prompt: "Review our documented policies for consistency. Are there any contradictions, outdated references, or areas where policies might conflict with each other?",
    category: "internal",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "builtin-internal-training",
    title: "Security training content",
    prompt: "Help me create security awareness training content for employees based on our policies and procedures. Focus on practical, actionable guidance that aligns with our documented practices.",
    category: "internal",
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

// LocalStorage key for user-saved prompts
export const CHAT_PROMPTS_STORAGE_KEY = "grc-minion-chat-prompts";

// LocalStorage key for built-in prompt overrides (edits to built-in prompts)
export const BUILTIN_PROMPT_OVERRIDES_KEY = "grc-minion-builtin-prompt-overrides";

// Type for storing overrides to built-in prompts
export type PromptOverride = {
  title: string;
  prompt: string;
  category: string;
  lastModified: string;
  modifiedBy?: string; // Optional: track who made the edit
};

// Load built-in prompt overrides from storage
export function loadBuiltInOverrides(): Record<string, PromptOverride> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(BUILTIN_PROMPT_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

// Save built-in prompt overrides to storage
export function saveBuiltInOverrides(overrides: Record<string, PromptOverride>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUILTIN_PROMPT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors
  }
}

// Load user prompts from storage
export function loadUserPrompts(): ChatPrompt[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CHAT_PROMPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ChatPrompt =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        typeof p.title === "string" &&
        typeof p.prompt === "string"
    );
  } catch {
    return [];
  }
}

// Save user prompts to storage
export function saveUserPrompts(prompts: ChatPrompt[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
  } catch {
    // Ignore storage errors
  }
}

// Get all prompts (built-in with overrides applied + user)
export function getAllPrompts(): ChatPrompt[] {
  const overrides = loadBuiltInOverrides();

  // Apply overrides to built-in prompts
  const effectiveBuiltIns = builtInPrompts.map(prompt => {
    const override = overrides[prompt.id];
    if (override) {
      return {
        ...prompt,
        title: override.title,
        prompt: override.prompt,
        category: override.category,
      };
    }
    return prompt;
  });

  return [...effectiveBuiltIns, ...loadUserPrompts()];
}

// Get effective built-in prompts (with overrides applied)
export function getEffectiveBuiltInPrompts(): ChatPrompt[] {
  const overrides = loadBuiltInOverrides();
  return builtInPrompts.map(prompt => {
    const override = overrides[prompt.id];
    if (override) {
      return {
        ...prompt,
        title: override.title,
        prompt: override.prompt,
        category: override.category,
      };
    }
    return prompt;
  });
}

// Check if a built-in prompt has been modified
export function isBuiltInModified(id: string): boolean {
  const overrides = loadBuiltInOverrides();
  return id in overrides;
}

// Get the original (default) built-in prompt
export function getOriginalBuiltInPrompt(id: string): ChatPrompt | undefined {
  return builtInPrompts.find(p => p.id === id);
}

// Add a new user prompt
export function addUserPrompt(title: string, prompt: string, category: string = "custom"): ChatPrompt {
  const newPrompt: ChatPrompt = {
    id: `user-${crypto.randomUUID()}`,
    title,
    prompt,
    category,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  };
  const existing = loadUserPrompts();
  saveUserPrompts([...existing, newPrompt]);
  return newPrompt;
}

// Update an existing user prompt
export function updateUserPrompt(id: string, updates: Partial<Pick<ChatPrompt, "title" | "prompt" | "category">>): boolean {
  if (id.startsWith("builtin-")) return false;
  const existing = loadUserPrompts();
  const index = existing.findIndex(p => p.id === id);
  if (index === -1) return false;
  existing[index] = { ...existing[index], ...updates };
  saveUserPrompts(existing);
  return true;
}

// Update a built-in prompt (saves as an override)
export function updateBuiltInPrompt(
  id: string,
  updates: { title: string; prompt: string; category: string },
  modifiedBy?: string
): boolean {
  if (!id.startsWith("builtin-")) return false;

  // Verify this is a valid built-in prompt
  const originalPrompt = builtInPrompts.find(p => p.id === id);
  if (!originalPrompt) return false;

  const overrides = loadBuiltInOverrides();
  overrides[id] = {
    title: updates.title,
    prompt: updates.prompt,
    category: updates.category,
    lastModified: new Date().toISOString(),
    modifiedBy,
  };
  saveBuiltInOverrides(overrides);
  return true;
}

// Reset a built-in prompt to its default (removes the override)
export function resetBuiltInPrompt(id: string): boolean {
  if (!id.startsWith("builtin-")) return false;

  const overrides = loadBuiltInOverrides();
  if (!(id in overrides)) return false;

  delete overrides[id];
  saveBuiltInOverrides(overrides);
  return true;
}

// Delete a user prompt (can't delete built-in prompts)
export function deleteUserPrompt(id: string): boolean {
  if (id.startsWith("builtin-")) return false;
  const existing = loadUserPrompts();
  const filtered = existing.filter(p => p.id !== id);
  if (filtered.length === existing.length) return false;
  saveUserPrompts(filtered);
  return true;
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

// LocalStorage key for custom categories
export const CUSTOM_CATEGORIES_KEY = "grc-minion-custom-categories";

// Category type definition
export type CategoryConfig = {
  id: string;
  label: string;
  description: string;
  color: { bg: string; text: string; border: string };
  isBuiltIn: boolean;
};

// Default built-in categories
export const defaultCategories: CategoryConfig[] = [
  {
    id: "rfp",
    label: "RFP & Questionnaires",
    description: "Pre-built prompts for responding to security questionnaires, vendor assessments, and RFPs",
    color: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
    isBuiltIn: true,
  },
  {
    id: "sales",
    label: "Sales Enablement",
    description: "Prompts to help sales teams handle security objections and position your security story",
    color: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
    isBuiltIn: true,
  },
  {
    id: "marketing",
    label: "Marketing Content",
    description: "Generate trust page content, security blog posts, and marketing collateral",
    color: { bg: "#fdf4ff", text: "#a21caf", border: "#e879f9" },
    isBuiltIn: true,
  },
  {
    id: "customer",
    label: "Customer Success",
    description: "Help customer success teams answer security questions and support customers",
    color: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
    isBuiltIn: true,
  },
  {
    id: "internal",
    label: "Internal Ops",
    description: "Internal operations prompts for gap analysis, policy reviews, and training",
    color: { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
    isBuiltIn: true,
  },
  {
    id: "custom",
    label: "My Prompts",
    description: "Your custom prompts saved from chat conversations",
    color: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
    isBuiltIn: true,
  },
];

// Available color presets for new categories
export const categoryColorPresets = [
  { name: "Blue", bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  { name: "Green", bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  { name: "Purple", bg: "#fdf4ff", text: "#a21caf", border: "#e879f9" },
  { name: "Yellow", bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  { name: "Violet", bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
  { name: "Gray", bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  { name: "Red", bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  { name: "Teal", bg: "#f0fdfa", text: "#0d9488", border: "#5eead4" },
  { name: "Orange", bg: "#fff7ed", text: "#ea580c", border: "#fdba74" },
  { name: "Pink", bg: "#fdf2f8", text: "#db2777", border: "#f9a8d4" },
];

// Load custom categories from storage
export function loadCustomCategories(): CategoryConfig[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CategoryConfig =>
        typeof c === "object" &&
        c !== null &&
        typeof c.id === "string" &&
        typeof c.label === "string"
    );
  } catch {
    return [];
  }
}

// Save custom categories to storage
export function saveCustomCategories(categories: CategoryConfig[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage errors
  }
}

// Get all categories (built-in + custom)
export function getAllCategories(): CategoryConfig[] {
  return [...defaultCategories, ...loadCustomCategories()];
}

// Get category by ID
export function getCategoryById(id: string): CategoryConfig | undefined {
  return getAllCategories().find(c => c.id === id);
}

// Add a new custom category
export function addCustomCategory(
  label: string,
  description: string,
  color: { bg: string; text: string; border: string }
): CategoryConfig {
  const id = `cat-${crypto.randomUUID().substring(0, 8)}`;
  const newCategory: CategoryConfig = {
    id,
    label,
    description,
    color,
    isBuiltIn: false,
  };
  const existing = loadCustomCategories();
  saveCustomCategories([...existing, newCategory]);
  return newCategory;
}

// Update a category (custom only, or override built-in label/description)
export function updateCategory(
  id: string,
  updates: Partial<Pick<CategoryConfig, "label" | "description" | "color">>
): boolean {
  const customs = loadCustomCategories();
  const customIndex = customs.findIndex(c => c.id === id);

  if (customIndex !== -1) {
    // Update custom category
    customs[customIndex] = { ...customs[customIndex], ...updates };
    saveCustomCategories(customs);
    return true;
  }

  // For built-in categories, store as a custom override
  const builtIn = defaultCategories.find(c => c.id === id);
  if (builtIn) {
    const override: CategoryConfig = {
      ...builtIn,
      ...updates,
      isBuiltIn: true, // Keep the flag
    };
    saveCustomCategories([...customs, override]);
    return true;
  }

  return false;
}

// Delete a custom category (can't delete built-in)
export function deleteCategory(id: string): boolean {
  // Check if it's a built-in category
  if (defaultCategories.some(c => c.id === id)) {
    return false;
  }

  const existing = loadCustomCategories();
  const filtered = existing.filter(c => c.id !== id);
  if (filtered.length === existing.length) return false;
  saveCustomCategories(filtered);
  return true;
}

// Reset a built-in category to default
export function resetCategoryToDefault(id: string): boolean {
  const customs = loadCustomCategories();
  const filtered = customs.filter(c => c.id !== id);
  if (filtered.length === customs.length) return false;
  saveCustomCategories(filtered);
  return true;
}

// Check if a built-in category has been modified
export function isCategoryModified(id: string): boolean {
  const customs = loadCustomCategories();
  return customs.some(c => c.id === id && defaultCategories.some(d => d.id === id));
}

// Helper to get category config with overrides applied
export function getEffectiveCategories(): CategoryConfig[] {
  const customs = loadCustomCategories();
  const customIds = new Set(customs.map(c => c.id));

  // Start with built-ins that haven't been overridden
  const effective = defaultCategories.filter(c => !customIds.has(c.id));

  // Add all customs (including overrides of built-ins)
  return [...effective, ...customs];
}

// Legacy compatibility - derived from effective categories
export function getCategoryLabels(): Record<string, string> {
  const categories = getEffectiveCategories();
  return categories.reduce((acc, cat) => {
    acc[cat.id] = cat.label;
    return acc;
  }, {} as Record<string, string>);
}

export function getCategoryColors(): Record<string, { bg: string; text: string; border: string }> {
  const categories = getEffectiveCategories();
  return categories.reduce((acc, cat) => {
    acc[cat.id] = cat.color;
    return acc;
  }, {} as Record<string, { bg: string; text: string; border: string }>);
}

export function getCategoryDescriptions(): Record<string, string> {
  const categories = getEffectiveCategories();
  return categories.reduce((acc, cat) => {
    acc[cat.id] = cat.description;
    return acc;
  }, {} as Record<string, string>);
}

// Legacy exports for backward compatibility (static defaults for built-in categories)
export const categoryLabels: Record<BuiltInCategoryId, string> = {
  rfp: "RFP & Questionnaires",
  sales: "Sales Enablement",
  marketing: "Marketing Content",
  customer: "Customer Success",
  internal: "Internal Ops",
  custom: "My Prompts",
};

export const categoryColors: Record<BuiltInCategoryId, { bg: string; text: string; border: string }> = {
  rfp: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  sales: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  marketing: { bg: "#fdf4ff", text: "#a21caf", border: "#e879f9" },
  customer: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  internal: { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
  custom: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

export const categoryDescriptions: Record<BuiltInCategoryId, string> = {
  rfp: "Pre-built prompts for responding to security questionnaires, vendor assessments, and RFPs",
  sales: "Prompts to help sales teams handle security objections and position your security story",
  marketing: "Generate trust page content, security blog posts, and marketing collateral",
  customer: "Help customer success teams answer security questions and support customers",
  internal: "Internal operations prompts for gap analysis, policy reviews, and training",
  custom: "Your custom prompts saved from chat conversations",
};
