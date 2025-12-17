import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { ContractFinding, FindingCategory, AlignmentRating } from "@/types/contractReview";
import { logUsage } from "@/lib/usageTracking";
import {
  defaultContractAnalysisSections,
  buildContractAnalysisPromptFromSections,
  EditableContractAnalysisSection,
} from "@/lib/contractAnalysisPromptSections";
import { getAnthropicClient, parseJsonResponse } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 120; // 2 minutes for analysis

type AnalysisResult = {
  overallRating: "compliant" | "mostly_compliant" | "needs_review" | "high_risk";
  summary: string;
  findings: Array<{
    category: FindingCategory;
    clauseText: string;
    rating: AlignmentRating;
    rationale: string;
    suggestedResponse?: string;
  }>;
};

// POST /api/contracts/[id]/analyze - Analyze a contract against skills
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const authSession = await getServerSession(authOptions);
    const { id } = await params;

    // Get the contract
    const contract = await prisma.contractReview.findUnique({
      where: { id },
    });

    if (!contract) {
      return errors.notFound("Contract review");
    }

    // Update status to analyzing
    await prisma.contractReview.update({
      where: { id },
      data: { status: "ANALYZING" },
    });

    // Get all active skills for context
    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        content: true,
        categories: true,
      },
    });

    const anthropic = getAnthropicClient();

    // Build skills context - focus on security-related content
    const skillsContext = skills.length > 0
      ? skills.map((s) => `### ${s.title}\n${s.content.substring(0, 2000)}${s.content.length > 2000 ? "..." : ""}`).join("\n\n---\n\n")
      : "No skills available in the knowledge base.";

    // Truncate contract text if too long
    const maxContractLength = 50000;
    const contractText = contract.extractedText.length > maxContractLength
      ? contract.extractedText.substring(0, maxContractLength) + "\n\n[Contract text truncated for analysis]"
      : contract.extractedText;

    // Load prompt sections from database or use defaults
    let promptSections: EditableContractAnalysisSection[];
    try {
      const savedPrompt = await prisma.systemPrompt.findUnique({
        where: { key: "contract_analysis" },
      });
      if (savedPrompt?.sections && Array.isArray(savedPrompt.sections)) {
        promptSections = savedPrompt.sections as EditableContractAnalysisSection[];
      } else {
        promptSections = defaultContractAnalysisSections.map(s => ({
          ...s,
          enabled: true,
          text: s.defaultText,
        }));
      }
    } catch {
      promptSections = defaultContractAnalysisSections.map(s => ({
        ...s,
        enabled: true,
        text: s.defaultText,
      }));
    }

    // Build the prompt from sections
    const basePrompt = buildContractAnalysisPromptFromSections(promptSections);

    // Add skills context to the prompt
    const systemPrompt = `${basePrompt}

YOUR CAPABILITIES (use these to assess compliance):
${skillsContext}`;

    const userPrompt = `Analyze this ${contract.contractType || "contract"} from ${contract.customerName || "the customer"}:

---CONTRACT TEXT---
${contractText}
---END CONTRACT TEXT---

Identify and rate security-related clauses against our documented capabilities. Return your analysis as JSON.`;

    // Determine model speed
    const speed = getEffectiveSpeed("contracts-analyze");
    const model = getModel(speed);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 8000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Log usage
    logUsage({
      userId: authSession?.user?.id,
      userEmail: authSession?.user?.email,
      feature: "contracts-analyze",
      model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: { contractId: id, skillCount: skills.length },
    });

    // Parse the JSON response
    let result: AnalysisResult;
    try {
      result = parseJsonResponse<AnalysisResult>(content.text);
    } catch {
      logger.error("Failed to parse LLM response", new Error("Parse error"), { route: "/api/contracts/[id]/analyze", response: content.text.slice(0, 500) });
      await prisma.contractReview.update({
        where: { id },
        data: { status: "PENDING" },
      });
      throw new Error("Failed to parse analysis results");
    }

    // Transform findings with IDs
    const findings: ContractFinding[] = result.findings.map((f, index) => ({
      id: `finding-${index + 1}`,
      category: f.category,
      clauseText: f.clauseText,
      rating: f.rating,
      rationale: f.rationale,
      relevantSkills: [], // Could enhance to extract skill IDs from rationale
      suggestedResponse: f.suggestedResponse,
      flagged: f.rating === "risk" || f.rating === "gap", // Auto-flag risks and gaps
    }));

    // Update the contract with analysis results
    const updated = await prisma.contractReview.update({
      where: { id },
      data: {
        status: "ANALYZED",
        overallRating: result.overallRating,
        summary: result.summary,
        findings: JSON.parse(JSON.stringify(findings)),
        skillsUsed: skills.map((s) => s.id),
        analyzedAt: new Date(),
      },
    });

    return apiSuccess({
      analysis: {
        id: updated.id,
        status: updated.status,
        overallRating: updated.overallRating,
        summary: updated.summary,
        findings,
        analyzedAt: updated.analyzedAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Contract analysis failed", error, { route: "/api/contracts/[id]/analyze" });

    // Try to reset status on error
    try {
      const { id } = await params;
      await prisma.contractReview.update({
        where: { id },
        data: { status: "PENDING" },
      });
    } catch {
      // Ignore cleanup errors
    }

    return errors.internal(error instanceof Error ? error.message : "Analysis failed");
  }
}
