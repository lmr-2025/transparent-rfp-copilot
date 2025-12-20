export interface KnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  fileType: "pdf" | "doc" | "docx" | "txt" | "pptx";
  content: string; // Extracted text content
  fileSize: number; // bytes
  uploadedAt: string;
  description?: string;
  categories: string[]; // Uses same categories as Skills
  // Unified Knowledge Pipeline fields
  isReferenceOnly?: boolean; // True if saved as reference without skill conversion
  // Skill relationship (via SkillSource join table)
  skillCount?: number; // Number of skills using this document
}
