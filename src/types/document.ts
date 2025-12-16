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
  skillId?: string; // Link to skill if converted to skill
  isReferenceOnly?: boolean; // True if saved as reference without skill conversion
}
