// codex: tests for /api/documents/content route
import { describe, it, expect, vi } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    knowledgeDocument: {
      findMany: mockFindMany,
    },
  },
}));

const { GET } = await import("@/app/api/documents/content/route");

describe("GET /api/documents/content", () => {
  it("codex: returns document list", async () => {
    mockFindMany.mockResolvedValue([{ id: "d1", title: "Doc", filename: "doc.pdf", content: "text" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.documents).toHaveLength(1);
  });
});
