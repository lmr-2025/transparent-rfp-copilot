// codex: tests for /api/documents upload route
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getTestMocks } from "./testUtils";

const mockCreate = vi.fn();
const mockExtractRawText = vi.fn();

const { prismaMock } = getTestMocks();
vi.mock("mammoth", () => ({
  extractRawText: mockExtractRawText,
}));
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn().mockResolvedValue({ text: "pdf content" }),
  })),
}));

const routes = await import("@/app/api/documents/route");

const makeFormRequest = (entries: Record<string, string | File>) =>
  ({
    formData: async () => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(entries)) {
        fd.append(key, value);
      }
      return fd;
    },
  }) as unknown as NextRequest;

describe("POST /api/documents", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockExtractRawText.mockReset();
    mockExtractRawText.mockResolvedValue({ value: "doc content" });
    prismaMock.knowledgeDocument = {
      create: mockCreate,
    };
  });

  it("codex: validates required fields", async () => {
    const bad = await routes.POST(makeFormRequest({}));
    expect(bad.status).toBe(400);
  });

  it("codex: handles docx upload via mammoth", async () => {
    const file = new File(["data"], "test.docx");
    mockCreate.mockResolvedValue({
      id: "d1",
      title: "Doc",
      filename: "test.docx",
      fileType: "docx",
      fileSize: file.size,
      categories: [],
      uploadedAt: new Date(),
      description: null,
    });
    const res = await routes.POST(
      makeFormRequest({
        file,
        title: "Doc",
        categories: JSON.stringify([]),
      }),
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });
});
