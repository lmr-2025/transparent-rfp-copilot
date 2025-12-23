// codex: tests for /api/documents/content route
import { describe, it, expect, vi } from "vitest";

const mockFindMany = vi.fn();

const mockPrisma = {
  knowledgeDocument: {
    findMany: mockFindMany,
  },
};

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
vi.mock("@/lib/apiAuth", () => ({
  requireAuth: vi.fn(() => Promise.resolve({
    authorized: true,
    session: { user: { id: "user1", name: "Test", email: "test@example.com" } },
  })),
}));

const { GET } = await import("@/app/api/documents/content/route");

describe("GET /api/documents/content", () => {
  it("codex: returns document list", async () => {
    mockFindMany.mockResolvedValue([{ id: "d1", title: "Doc", filename: "doc.pdf", content: "text" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.documents).toHaveLength(1);
  });
});
