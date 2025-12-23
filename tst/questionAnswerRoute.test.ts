// codex: tests for /api/questions/answer route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockAnswer = vi.fn();
const mockLoadSystemPrompt = vi.fn();

vi.mock("@/lib/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
  return {
    ...actual,
    answerQuestionWithPrompt: mockAnswer,
  };
});
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
}));
vi.mock("@/lib/loadSystemPrompt", () => ({
  loadSystemPrompt: mockLoadSystemPrompt,
}));

const { POST } = await import("@/app/api/questions/answer/route");

const makeRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

describe("POST /api/questions/answer", () => {
  beforeEach(() => {
    mockAnswer.mockReset();
    mockLoadSystemPrompt.mockReset();
    mockLoadSystemPrompt.mockResolvedValue("system prompt");
  });

  it("codex: returns 400 when question missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error.message).toMatch(/question/i);
  });

  it("codex: proxies to answerQuestionWithPrompt", async () => {
    mockAnswer.mockResolvedValue({
      answer: "final",
      conversationHistory: [],
      usedFallback: false,
    });

    const res = await POST(
      makeRequest({
        question: " What is uptime? ",
        prompt: "",
        skills: [{ title: "SLA", content: "99.9%", tags: [] }],
      }),
    );

    expect(mockAnswer).toHaveBeenCalledWith(
      "What is uptime?",
      expect.any(String),
      expect.any(Array),
      undefined,
      "quality",
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.answer).toBe("final");
  });
});
