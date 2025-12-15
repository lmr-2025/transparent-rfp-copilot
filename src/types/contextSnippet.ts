export interface ContextSnippet {
  id: string;
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}
