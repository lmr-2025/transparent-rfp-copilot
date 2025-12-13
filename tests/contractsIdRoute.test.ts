// codex: tests for /api/contracts/[id] route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    contractReview: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

const routes = await import("@/app/api/contracts/[id]/route");

const makeRequest = (body?: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/api/contracts/[id]", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it("codex: GET returns 404 when missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await routes.GET(makeRequest(), makeContext("404"));
    expect(res.status).toBe(404);
  });

  it("codex: PUT sets reviewed metadata when status is REVIEWED", async () => {
    mockUpdate.mockResolvedValue({
      id: "c1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await routes.PUT(
      makeRequest({ status: "REVIEWED", reviewedBy: "user@example.com" }),
      makeContext("c1"),
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("codex: DELETE removes contract review", async () => {
    const res = await routes.DELETE(makeRequest(), makeContext("c1"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
