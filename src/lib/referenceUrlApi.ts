// Reference URL API client

export type ReferenceUrl = {
  id: string;
  url: string;
  title?: string;
  description?: string;
  category?: string;
  addedAt: string;
  lastUsedAt?: string;
  usageCount: number;
};

export async function fetchAllReferenceUrls(category?: string): Promise<ReferenceUrl[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  const response = await fetch(`/api/reference-urls${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch reference URLs");
  }
  return response.json();
}

export async function createReferenceUrl(
  url: string,
  options?: { title?: string; description?: string; category?: string }
): Promise<ReferenceUrl> {
  const response = await fetch("/api/reference-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...options }),
  });
  if (!response.ok) {
    throw new Error("Failed to create reference URL");
  }
  return response.json();
}

export async function updateReferenceUrl(
  id: string,
  updates: Partial<Omit<ReferenceUrl, "id" | "addedAt">>
): Promise<ReferenceUrl> {
  const response = await fetch(`/api/reference-urls/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error("Failed to update reference URL");
  }
  return response.json();
}

export async function deleteReferenceUrl(id: string): Promise<void> {
  const response = await fetch(`/api/reference-urls/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete reference URL");
  }
}

export async function bulkImportUrls(
  urls: Array<{ url: string; title?: string; description?: string; category?: string }>
): Promise<{ imported: number; urls: ReferenceUrl[] }> {
  const response = await fetch("/api/reference-urls", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!response.ok) {
    throw new Error("Failed to import reference URLs");
  }
  return response.json();
}
