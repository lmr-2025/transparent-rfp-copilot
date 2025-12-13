export interface ReferenceUrl {
  id: string;
  url: string;
  title: string; // User-friendly name like "Trust Center" or "Security Whitepaper"
  description?: string; // Optional description of what this URL contains
  categories: string[]; // Uses same categories as Skills
  addedAt: string;
  lastUsedAt?: string;
  usageCount: number;
}
