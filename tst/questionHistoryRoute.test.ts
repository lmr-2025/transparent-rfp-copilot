// codex: tests for /api/question-history routes
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindFirst = vi.fn();
const mockDelete = vi.fn();

const { prismaMock } = getTestMocks();

const { GET, POST, DELETE } = await import("@/app/api/question-history/route");
const { DELETE: DELETE_BY_ID } = await import("@/app/api/question-history/[id]/route");

const makeRequest = (opts: { body?: unknown; params?: Record<string, string> } = {}) =>
  ({
    json: async () => opts.body,
    nextUrl: new URL("https://example.com/api/question-history"),
  }) as unknown as NextRequest;

describe("/api/question-history", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockDeleteMany.mockReset();
    prismaMock.questionHistory = {
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
      deleteMany: mockDeleteMany,
      findFirst: mockFindFirst,
      delete: mockDelete,
    };
  });

  it("codex: GET returns empty data when DB returns none", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const res = await GET(makeRequest());
    const payload = await res.json();
    expect(res.status).toBe(200);
    expect(payload.data.history).toEqual([]);
    expect(payload.data.total).toBe(0);
  });

  it("codex: POST validates required fields", async () => {
    const bad = await POST(makeRequest({ body: {} }));
    expect(bad.status).toBe(400);

    mockCreate.mockResolvedValue({ id: "h1" });
    const ok = await POST(
      makeRequest({ body: { question: "Q?", response: "A." } }),
    );
    expect(ok.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("codex: DELETE clears by user", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

describe("/api/question-history/[id]", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockDelete.mockReset();
    prismaMock.questionHistory = {
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
      deleteMany: mockDeleteMany,
      findFirst: mockFindFirst,
      delete: mockDelete,
    };
  });

  it("codex: DELETE enforces ownership", async () => {
    mockFindFirst.mockResolvedValue(null);
    const req = makeRequest();
    const res404 = await DELETE_BY_ID(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res404.status).toBe(404);

    mockFindFirst.mockResolvedValue({ id: "h1" });
    const res = await DELETE_BY_ID(req, { params: Promise.resolve({ id: "h1" }) });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });
});
