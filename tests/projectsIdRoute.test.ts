// codex: tests for /api/projects/[id] route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockDeleteMany = vi.fn();
const mockCreateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    bulkProject: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
    projectCustomerProfile: {
      deleteMany: mockDeleteMany,
      createMany: mockCreateMany,
    },
  },
}));

const routes = await import("@/app/api/projects/[id]/route");

const makeRequest = (body?: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/api/projects/[id]", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockDeleteMany.mockReset();
    mockCreateMany.mockReset();
  });

  it("codex: GET returns 404 when missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await routes.GET(makeRequest(), makeContext("missing"));
    expect(res.status).toBe(404);
  });

  it("codex: PUT updates project and customer profiles", async () => {
    mockUpdate.mockResolvedValue({
      id: "p1",
      customerProfiles: [],
      rows: [],
    });

    const res = await routes.PUT(
      makeRequest({
        name: "Updated",
        customerProfileIds: ["c1"],
        rows: [{ rowNumber: 1, question: "Q" }],
      }),
      makeContext("p1"),
    );

    expect(mockDeleteMany).toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [{ projectId: "p1", profileId: "c1" }],
    });
    expect(res.status).toBe(200);
  });

  it("codex: DELETE removes project", async () => {
    const res = await routes.DELETE(makeRequest(), makeContext("p1"));
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(res.status).toBe(200);
  });
});
