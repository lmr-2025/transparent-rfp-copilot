/**
 * Template Types
 * For template-based deliverables system
 */

// ============================================
// Placeholder Types & Constants
// ============================================

// Placeholder types in templates
export type PlaceholderType = "customer" | "gtm" | "skill" | "llm" | "date" | "custom";

// Data sources for placeholder mappings
export type PlaceholderSource =
  | "customer"    // Customer profile fields
  | "skill"       // Skill content
  | "gtm"         // GTM data (Gong, HubSpot, Looker)
  | "date"        // Date/time values
  | "llm"         // LLM-generated content
  | "custom";     // User-provided at fill time

// Customer fields available for mapping
export const CUSTOMER_FIELDS = [
  { value: "name", label: "Company Name" },
  { value: "industry", label: "Industry" },
  { value: "region", label: "Region" },
  { value: "tier", label: "Tier" },
  { value: "content", label: "Full Profile Content" },
  { value: "considerations", label: "Considerations" },
  { value: "website", label: "Website" },
  { value: "employeeCount", label: "Employee Count" },
  { value: "annualRevenue", label: "Annual Revenue" },
  { value: "accountType", label: "Account Type" },
] as const;

// Skill fields available for mapping
export const SKILL_FIELDS = [
  { value: "all", label: "All Skills Combined" },
  { value: "titles", label: "Skill Titles List" },
  { value: "byTitle", label: "Specific Skill by Title" },
] as const;

// GTM fields available for mapping
export const GTM_FIELDS = [
  { value: "recent_calls_summary", label: "Recent Gong Calls Summary" },
  { value: "recent_activities", label: "Recent HubSpot Activities" },
  { value: "metrics_summary", label: "Looker Metrics Summary" },
] as const;

// Date formats available for mapping
export const DATE_FIELDS = [
  { value: "today", label: "Today's Date" },
  { value: "now", label: "Current Date & Time" },
  { value: "year", label: "Current Year" },
  { value: "month", label: "Current Month" },
  { value: "quarter", label: "Current Quarter (Q1-Q4)" },
  { value: "iso", label: "ISO Format" },
] as const;

// A single placeholder mapping configuration
export type PlaceholderMapping = {
  placeholder: string;        // The placeholder text (e.g., "Customer Name" or "customer.name")
  source: PlaceholderSource;  // Where to get the data
  field?: string;             // Specific field within the source (e.g., "name" for customer)
  skillTitle?: string;        // For skill source with byTitle - which skill to use
  llmInstruction?: string;    // For LLM source - the generation instruction
  fallback?: string;          // Default value if data not available
  required?: boolean;         // Whether this must be filled before generating
};

// Parsed placeholder from template content
export type ParsedPlaceholder = {
  fullMatch: string; // e.g., "{{customer.name}}"
  type: PlaceholderType;
  field: string; // e.g., "name" for customer.name, or instruction for llm
  defaultValue?: string;
};

// ============================================
// Template Types
// ============================================

// Template from database
export type Template = {
  id: string;
  name: string;
  description: string | null;
  content: string; // Markdown with placeholders
  category: string | null;
  outputFormat: "markdown" | "docx" | "pdf";
  placeholderHint: string | null; // Help text for placeholder usage (deprecated)
  placeholderMappings: PlaceholderMapping[] | null; // Configured placeholder mappings
  instructionPresetId: string | null; // Linked instruction preset for auto-selection
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
};

// Template for API responses (dates as strings)
export type TemplateResponse = Omit<Template, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

// For creating a new template
export type CreateTemplateInput = {
  name: string;
  description?: string;
  content: string;
  category?: string;
  outputFormat?: "markdown" | "docx" | "pdf";
  placeholderHint?: string;
  placeholderMappings?: PlaceholderMapping[];
  instructionPresetId?: string;
  isActive?: boolean;
  sortOrder?: number;
};

// For updating a template
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

// ============================================
// Fill Context Types
// ============================================

// Context for filling templates
export type TemplateFillContext = {
  customer?: {
    id: string;
    name: string;
    industry?: string;
    region?: string;
    tier?: string;
    content?: string;
    considerations?: string[];
    [key: string]: unknown;
  };
  gtm?: {
    gongCalls?: Array<{
      id: string;
      title: string;
      date: string;
      summary?: string;
      participants: string[];
    }>;
    hubspotActivities?: Array<{
      id: string;
      type: string;
      date: string;
      subject: string;
      content?: string;
    }>;
    lookerMetrics?: Array<{
      period: string;
      metrics: Record<string, string | number>;
    }>;
  };
  skills?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  custom?: Record<string, string>; // User-provided custom values
};

// Request to fill a template
export type FillTemplateRequest = {
  templateId: string;
  context: TemplateFillContext;
  outputFormat?: "markdown" | "docx"; // PDF not yet supported
};

// Response from filling a template
export type FillTemplateResponse = {
  filledContent: string;
  outputFormat: "markdown" | "docx";
  docxBase64?: string; // Base64-encoded DOCX file for download
  placeholdersUsed: string[];
  placeholdersMissing: string[];
  llmGeneratedSections: string[]; // Which {{llm:...}} placeholders were filled
  template: {
    id: string;
    name: string;
    category: string | null;
  };
};

// ============================================
// Constants
// ============================================

// Template categories for organization
export const TEMPLATE_CATEGORIES = [
  "sales",
  "proposals",
  "battlecards",
  "presentations",
  "reports",
  "other",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// Output formats
export const OUTPUT_FORMATS = ["markdown", "docx", "pdf"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
