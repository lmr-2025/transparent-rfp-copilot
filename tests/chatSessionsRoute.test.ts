// codex: tests for /api/chat-sessions routes
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    chatSession: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      deleteMany: mockDeleteMany,
      findFirst: mockFindFirst,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } }),
}));

const routes = await import("@/app/api/chat-sessions/route");
const sessionRoutes = await import("@/app/api/chat-sessions/[id]/route");

const makeRequest = (body?: unknown) =>
  ({
    json: async () => body,
    nextUrl: new URL("https://example.com/api/chat-sessions"),
  }) as unknown as NextRequest;

describe("/api/chat-sessions", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockCreate.mockReset();
    mockDeleteMany.mockReset();
  });

  it("codex: GET returns paginated sessions", async () => {
    mockFindMany.mockResolvedValue([{ id: "s1" }]);
    mockCount.mockResolvedValue(1);
    const res = await routes.GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sessions).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("codex: POST validates messages array", async () => {
    const bad = await routes.POST(makeRequest({}));
    expect(bad.status).toBe(400);

    mockCreate.mockResolvedValue({ id: "s1" });
    const res = await routes.POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe("/api/chat-sessions/[id]", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it("codex: GET returns session when accessible", async () => {
    mockFindFirst.mockResolvedValue({ id: "s1" });
    const res = await sessionRoutes.GET(makeRequest(), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
  });

  it("codex: DELETE removes owned session", async () => {
    mockFindFirst.mockResolvedValue({ id: "s1" });
    const res = await sessionRoutes.DELETE(makeRequest(), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
