// codex: tests for prompt section builders
import { describe, it, expect } from "vitest";
import { buildChatPromptFromSections, buildPromptFromSections, defaultChatSections } from "@/lib/promptSections";

describe("buildPromptFromSections", () => {
  it("codex: concatenates sections with headings", () => {
    const prompt = buildPromptFromSections([
      { id: "a", title: "Title A", description: "", defaultText: "Line A" },
      { id: "b", title: "Title B", description: "", defaultText: "Line B" },
    ]);
    expect(prompt).toContain("## Title A");
    expect(prompt).toContain("Line B");
  });
});

describe("buildChatPromptFromSections", () => {
  it("codex: includes enabled sections and knowledge context", () => {
    const sections = defaultChatSections.map((section) => ({
      ...section,
      enabled: true,
      text: `[${section.id}]`,
    }));
    const prompt = buildChatPromptFromSections(sections, "Knowledge goes here");
    expect(prompt).toContain("KNOWLEDGE BASE:\nKnowledge goes here");
    expect(prompt).toContain("[chat_role]");
    expect(prompt).toContain("INSTRUCTIONS:");
    expect(prompt).toContain("RESPONSE STYLE:");
  });

  it("codex: skips disabled sections gracefully", () => {
    const prompt = buildChatPromptFromSections(
      [
        { ...defaultChatSections[0], enabled: false, text: "" },
        { ...defaultChatSections[1], enabled: true, text: "Use KB" },
        { ...defaultChatSections[2], enabled: false, text: "" },
      ],
      "Context",
    );
    expect(prompt.startsWith("KNOWLEDGE BASE")).toBe(true);
    expect(prompt).toContain("INSTRUCTIONS:\nUse KB");
    expect(prompt).not.toContain("RESPONSE STYLE:");
  });
});
