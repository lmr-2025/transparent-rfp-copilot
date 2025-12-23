// codex: tests for /api/contracts/[id]/analyze route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockFindManySkills = vi.fn();
const mockDeleteManyFindings = vi.fn();
const mockCreateManyFindings = vi.fn();
const mockAnthropicCreate = vi.fn();
const mockLogUsage = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
    };
  },
}));
const { prismaMock } = getTestMocks();
vi.mock("@/lib/usageTracking", () => ({
  logUsage: mockLogUsage,
}));

const routes = await import("@/app/api/contracts/[id]/analyze/route");

const makeRequest = () => ({}) as NextRequest;
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/contracts/[id]/analyze", () => {
beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockFindManySkills.mockReset();
  mockDeleteManyFindings.mockReset();
  mockCreateManyFindings.mockReset();
  mockAnthropicCreate.mockReset();
  mockLogUsage.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  prismaMock.contractReview = {
    findUnique: mockFindUnique,
    update: mockUpdate,
  };
  prismaMock.contractFinding = {
    deleteMany: mockDeleteManyFindings,
    createMany: mockCreateManyFindings,
  };
  prismaMock.skill = {
    findMany: mockFindManySkills,
  };
});

  it("codex: returns 404 if contract missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await routes.POST(makeRequest(), makeContext("c1"));
    expect(res.status).toBe(404);
  });

  it("codex: analyzes contract with skills context", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      extractedText: "contract text",
      contractType: "MSA",
      customerName: "Acme",
    });
    mockFindManySkills.mockResolvedValue([
      { id: "s1", title: "Skill", content: "Details", categories: [], tags: [] },
    ]);
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ overallRating: "compliant", summary: "ok", findings: [] }) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    mockUpdate
      .mockResolvedValueOnce({ id: "c1" }) // status -> ANALYZING
      .mockResolvedValueOnce({
        id: "c1",
        status: "ANALYZED",
        overallRating: "compliant",
        summary: "ok",
        analyzedAt: new Date(),
        findings: [],
      });

    const res = await routes.POST(makeRequest(), makeContext("c1"));
    expect(res.status).toBe(200);
    expect(mockLogUsage).toHaveBeenCalled();
    const payload = await res.json();
    expect(payload.data.analysis.overallRating).toBe("compliant");
  });
});
