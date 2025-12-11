import { Skill } from "@/types/skill";

export type ParsedAnswerSections = {
  response: string;
  confidence: string;
  sources: string;
  remarks: string;
};

/**
 * Parses an LLM answer into structured sections: response, confidence, sources, and remarks.
 * Looks for section headers like "Confidence:", "Sources:", "Remarks:" and separates content accordingly.
 */
export const parseAnswerSections = (answer: string): ParsedAnswerSections => {
  const lines = answer.split("\n");
  const sectionBuckets: Record<string, string[]> = {
    confidence: [],
    sources: [],
    remarks: [],
  };

  let currentSection: "confidence" | "sources" | "remarks" | null = null;
  let responseBody = "";
  const responseLinesBeforeFirstSection: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const lineLower = line.toLowerCase();

    if (
      lineLower.startsWith("confidence:") ||
      lineLower.startsWith("**confidence:**") ||
      lineLower === "confidence" ||
      lineLower === "**confidence**"
    ) {
      currentSection = "confidence";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.confidence.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("sources:") ||
      lineLower.startsWith("**sources:**") ||
      lineLower === "sources" ||
      lineLower === "**sources**"
    ) {
      currentSection = "sources";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.sources.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("remarks:") ||
      lineLower.startsWith("**remarks:**") ||
      lineLower === "remarks" ||
      lineLower === "**remarks**"
    ) {
      currentSection = "remarks";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.remarks.push(rest);
        }
      }
      continue;
    }

    if (currentSection) {
      sectionBuckets[currentSection].push(rawLine);
    } else {
      responseLinesBeforeFirstSection.push(rawLine);
    }
  }

  responseBody = responseLinesBeforeFirstSection.join("\n").trim();
  return {
    response: responseBody || answer.trim(),
    confidence: sectionBuckets.confidence.join("\n"),
    sources: sectionBuckets.sources.join("\n"),
    remarks: sectionBuckets.remarks.join("\n"),
  };
};

/**
 * Selects relevant skills based on question keywords.
 * Scores skills by:
 * - Title matches: 10 points
 * - Tag matches: 5 points
 * - Content keyword matches: 1 point each
 * Returns top 5 skills with score > 0
 */
export const selectRelevantSkills = (question: string, allSkills: Skill[]): Skill[] => {
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/\s+/).filter((word) => word.length > 3);

  const activeSkills = allSkills.filter((skill) => skill.isActive);

  // Score each skill based on keyword matches
  const scoredSkills = activeSkills.map((skill) => {
    let score = 0;
    const skillText = `${skill.title} ${skill.tags.join(" ")} ${skill.content}`.toLowerCase();

    // Title matches are worth more
    if (skill.title.toLowerCase().split(/\s+/).some((word) => questionWords.includes(word))) {
      score += 10;
    }

    // Tag matches
    skill.tags.forEach((tag) => {
      if (questionLower.includes(tag.toLowerCase())) {
        score += 5;
      }
    });

    // Content keyword matches
    questionWords.forEach((word) => {
      if (skillText.includes(word)) {
        score += 1;
      }
    });

    return { skill, score };
  });

  // Return top 5 skills with score > 0
  return scoredSkills
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.skill);
};
