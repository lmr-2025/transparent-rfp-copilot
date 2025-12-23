// codex: tests for /api/contracts/[id] route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const { prismaMock } = getTestMocks();

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
    prismaMock.contractReview = {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    };
  });

  it("codex: GET returns 404 when missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await routes.GET(makeRequest(), makeContext("404"));
    expect(res.status).toBe(404);
  });

  it("codex: PUT sets reviewed metadata when status is REVIEWED", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      name: "Contract",
      customerName: "Acme",
    });
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
    mockFindUnique.mockResolvedValue({
      id: "c1",
      name: "Contract",
      customerName: "Acme",
    });
    const res = await routes.DELETE(makeRequest(), makeContext("c1"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
