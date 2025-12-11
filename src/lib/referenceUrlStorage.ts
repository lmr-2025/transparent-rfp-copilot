import { ReferenceUrl } from "@/types/referenceUrl";

const STORAGE_KEY = "grc-minion-reference-urls";

export function loadReferenceUrls(): ReferenceUrl[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReferenceUrls(urls: ReferenceUrl[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
}

export function addReferenceUrl(url: Omit<ReferenceUrl, "id" | "createdAt">): ReferenceUrl {
  const urls = loadReferenceUrls();
  const newUrl: ReferenceUrl = {
    ...url,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  urls.push(newUrl);
  saveReferenceUrls(urls);
  return newUrl;
}

export function deleteReferenceUrl(id: string): void {
  const urls = loadReferenceUrls();
  const filtered = urls.filter((u) => u.id !== id);
  saveReferenceUrls(filtered);
}

export function updateReferenceUrl(id: string, updates: Partial<Omit<ReferenceUrl, "id" | "createdAt">>): ReferenceUrl | null {
  const urls = loadReferenceUrls();
  const index = urls.findIndex((u) => u.id === id);
  if (index === -1) return null;
  urls[index] = { ...urls[index], ...updates };
  saveReferenceUrls(urls);
  return urls[index];
}
