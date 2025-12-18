/**
 * Template Types
 * For template-based deliverables system
 */

// Template from database
export type Template = {
  id: string;
  name: string;
  description: string | null;
  content: string; // Markdown with placeholders
  category: string | null;
  outputFormat: "markdown" | "docx" | "pdf";
  placeholderHint: string | null; // Help text for placeholder usage
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
  isActive?: boolean;
  sortOrder?: number;
};

// For updating a template
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

// Placeholder types in templates
export type PlaceholderType = "customer" | "gtm" | "skill" | "llm" | "date" | "custom";

// Parsed placeholder from template content
export type ParsedPlaceholder = {
  fullMatch: string; // e.g., "{{customer.name}}"
  type: PlaceholderType;
  field: string; // e.g., "name" for customer.name, or instruction for llm
  defaultValue?: string;
};

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
