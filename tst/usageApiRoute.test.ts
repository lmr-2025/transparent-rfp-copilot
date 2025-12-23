// codex: tests for /api/usage route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockAggregate = vi.fn();
const mockGroupBy = vi.fn();
const mockFindMany = vi.fn();

const mockPrisma = {
  apiUsage: {
    aggregate: mockAggregate,
    groupBy: mockGroupBy,
    findMany: mockFindMany,
  },
};

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
vi.mock("@/lib/usageTracking", () => ({
  getDailyUsage: vi.fn().mockResolvedValue([]),
  getUserUsageSummary: vi.fn(),
  getUsageByFeature: vi.fn(),
}));
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

const { GET } = await import("@/app/api/usage/route");

const makeRequest = (url = "https://example.com/api/usage") =>
  ({
    nextUrl: new URL(url),
  }) as unknown as NextRequest;

describe("GET /api/usage", () => {
  beforeEach(() => {
    mockAggregate.mockReset();
    mockGroupBy.mockReset();
    mockFindMany.mockReset();
    mockGetServerSession.mockReset();
    mockAggregate.mockResolvedValue({
      _sum: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      _count: 0,
    });
    mockGroupBy.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
  });

  it("codex: returns zeros for anonymous user", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.summary.totalTokens).toBe(0);
    expect(payload.data.byFeature).toEqual([]);
    expect(payload.data.daily).toEqual([]);
  });

  it("codex: respects feature filter query param", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    await GET(makeRequest("https://example.com/api/usage?feature=chat"));
    expect(mockAggregate).toHaveBeenCalled();
    expect(mockGroupBy).toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalled();
  });
});
