export interface KnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  fileType: "pdf" | "doc" | "docx" | "txt";
  content: string; // Extracted text content
  fileSize: number; // bytes
  uploadedAt: string;
  description?: string;
  categories: string[]; // Uses same categories as Skills
}
