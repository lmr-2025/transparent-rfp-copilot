// codex: tests for /api/projects/[id] route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockDeleteMany = vi.fn();
const mockCreateMany = vi.fn();
const mockFindManyProfiles = vi.fn();
const mockBulkRowDeleteMany = vi.fn();
const mockBulkRowUpsert = vi.fn();
const mockTransaction = vi.fn();
const { prismaMock } = getTestMocks();

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
    mockFindManyProfiles.mockReset();
    mockBulkRowDeleteMany.mockReset();
    mockBulkRowUpsert.mockReset();
    mockTransaction.mockReset();

    mockTransaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      return callback(prismaMock);
    });

    prismaMock.bulkProject = {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    };
    prismaMock.projectCustomerProfile = {
      findMany: mockFindManyProfiles,
      deleteMany: mockDeleteMany,
      createMany: mockCreateMany,
    };
    prismaMock.bulkRow = {
      deleteMany: mockBulkRowDeleteMany,
      upsert: mockBulkRowUpsert,
    };
    prismaMock.$transaction = mockTransaction;
  });

  it("codex: GET returns 404 when missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await routes.GET(makeRequest(), makeContext("missing"));
    expect(res.status).toBe(404);
  });

  it("codex: PUT updates project and customer profiles", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: "p1", status: "PENDING" })
      .mockResolvedValueOnce({
        id: "p1",
        customerProfiles: [],
        rows: [],
      });
    mockFindManyProfiles.mockResolvedValue([]);
    mockUpdate.mockResolvedValue({ id: "p1" });

    const res = await routes.PUT(
      makeRequest({
        name: "Updated",
        customerProfileIds: ["c1"],
        rows: [{ rowNumber: 1, question: "Q" }],
      }),
      makeContext("p1"),
    );

    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [{ projectId: "p1", profileId: "c1" }],
    });
    expect(res.status).toBe(200);
  });

  it("codex: DELETE removes project", async () => {
    mockFindUnique.mockResolvedValue({ id: "p1" });
    const res = await routes.DELETE(makeRequest(), makeContext("p1"));
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(res.status).toBe(200);
  });
});
