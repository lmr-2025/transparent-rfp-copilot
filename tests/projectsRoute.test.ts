// codex: tests for /api/projects routes
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    bulkProject: {
      findMany: mockFindMany,
      create: mockCreate,
    },
  },
}));

const routes = await import("@/app/api/projects/route");

const makeRequest = (body?: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

describe("/api/projects route", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCreate.mockReset();
  });

  it("codex: GET returns flattened customer profiles", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "p1",
        customerProfiles: [
          { profile: { id: "c1", name: "Acme", industry: "Fintech" } },
        ],
      },
    ]);
    const res = await routes.GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.projects[0].customerProfiles[0].name).toBe("Acme");
  });

  it("codex: POST enforces required fields", async () => {
    const bad = await routes.POST(makeRequest({}));
    expect(bad.status).toBe(400);

    mockCreate.mockResolvedValue({ id: "p1", rows: [] });
    const ok = await routes.POST(
      makeRequest({
        name: "Project",
        sheetName: "Sheet",
        columns: ["Question"],
        rows: [{ rowNumber: 1, question: "Q" }],
      }),
    );
    expect(ok.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });
});
