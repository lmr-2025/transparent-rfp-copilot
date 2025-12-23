// codex: tests for /api/documents/content route
import { describe, it, expect, vi } from "vitest";
import { getTestMocks } from "./testUtils";

const mockFindMany = vi.fn();

const { prismaMock } = getTestMocks();

const { GET } = await import("@/app/api/documents/content/route");

describe("GET /api/documents/content", () => {
  it("codex: returns document list", async () => {
    mockFindMany.mockResolvedValue([{ id: "d1", title: "Doc", filename: "doc.pdf", content: "text" }]);
    prismaMock.knowledgeDocument = {
      findMany: mockFindMany,
    };
    const res = await GET();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.documents).toHaveLength(1);
  });
});
