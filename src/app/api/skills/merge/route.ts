import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_MODEL } from "@/lib/config";
import { getAnthropicClient, parseJsonResponse } from "@/lib/apiHelpers";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

type MergeRequestBody = {
  targetSkill: {
    title: string;
    content: string;
  };
  skillsToMerge: {
    title: string;
    content: string;
  }[];
};

type MergeResponse = {
  title: string;
  content: string;
};

export async function POST(request: NextRequest) {
  let body: MergeRequestBody;
  try {
    body = (await request.json()) as MergeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.targetSkill || !body.skillsToMerge || body.skillsToMerge.length === 0) {
    return NextResponse.json({ error: "Missing targetSkill or skillsToMerge." }, { status: 400 });
  }

  try {
    const anthropic = getAnthropicClient();

    const allSkills = [body.targetSkill, ...body.skillsToMerge];
    const skillsContent = allSkills.map((s, i) =>
      `=== SKILL ${i + 1}: "${s.title}" ===\n${s.content}`
    ).join("\n\n---\n\n");

    // Load the system prompt from the block system (editable via /admin/prompt-blocks)
    const systemPrompt = await loadSystemPrompt("skill_organize", "You are a knowledge management expert.");

    // Add task-specific context for merging
    const mergeContext = `
Your task is to intelligently merge the provided skills into a single, well-organized document.

MERGE-SPECIFIC GOALS:
1. Remove duplicate information - don't repeat the same facts
2. Organize content logically with clear sections
3. Preserve all unique, valuable information from each skill
4. Create a coherent narrative that flows well
5. Use clear markdown headers (##, ###) to organize sections

Return ONLY a JSON object with "title" and "content" fields.`;

    const userPrompt = `Please merge the following ${allSkills.length} skills into one comprehensive document:

${skillsContent}

Merge these into a single, well-organized skill document. Remove duplicates, organize logically, and preserve all unique information.

Return ONLY the JSON object.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      system: systemPrompt + mergeContext,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    const result = parseJsonResponse<MergeResponse>(content.text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to merge skills:", error);
    const message = error instanceof Error ? error.message : "Failed to merge skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
