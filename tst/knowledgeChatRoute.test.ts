// codex: tests for /api/knowledge-chat route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockAnthropicCreate = vi.fn();
const mockLogUsage = vi.fn();
const mockFindManyDocuments = vi.fn();
const mockFindManyCustomerDocs = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: class MockAnthropic {
      messages = {
        create: mockAnthropicCreate,
      };
    },
  };
});
vi.mock("@/lib/usageTracking", () => ({
  logUsage: mockLogUsage,
}));
const { prismaMock } = getTestMocks();

const { POST } = await import("@/app/api/knowledge-chat/route");

const makeRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

describe("POST /api/knowledge-chat", () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "response" }],
    });
    mockFindManyDocuments.mockReset();
    mockFindManyCustomerDocs.mockReset();
    mockFindManyDocuments.mockResolvedValue([]);
    mockFindManyCustomerDocs.mockResolvedValue([]);
    prismaMock.knowledgeDocument = {
      findMany: mockFindManyDocuments,
    };
    prismaMock.customerDocument = {
      findMany: mockFindManyCustomerDocs,
    };
  });

  it("codex: validates required message", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("codex: calls anthropic with assembled system prompt", async () => {
    const body = {
      message: "Hello",
      skills: [{ id: "s1", title: "Skill", content: "Details", tags: [] }],
      conversationHistory: [{ role: "assistant", content: "Previous" }],
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockAnthropicCreate).toHaveBeenCalled();
    const payload = await res.json();
    expect(payload.data.response).toBe("response");
  });
});
