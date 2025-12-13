import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import { ContractFinding, FindingCategory, AlignmentRating } from "@/types/contractReview";
import { logUsage } from "@/lib/usageTracking";

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
  try {
    const authSession = await getServerSession(authOptions);
    const { id } = await params;

    // Get the contract
    const contract = await prisma.contractReview.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract review not found" },
        { status: 404 }
      );
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
        tags: true,
      },
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await prisma.contractReview.update({
        where: { id },
        data: { status: "PENDING" },
      });
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build skills context - focus on security-related content
    const skillsContext = skills.length > 0
      ? skills.map((s) => `### ${s.title}\n${s.content.substring(0, 2000)}${s.content.length > 2000 ? "..." : ""}`).join("\n\n---\n\n")
      : "No skills available in the knowledge base.";

    // Truncate contract text if too long
    const maxContractLength = 50000;
    const contractText = contract.extractedText.length > maxContractLength
      ? contract.extractedText.substring(0, maxContractLength) + "\n\n[Contract text truncated for analysis]"
      : contract.extractedText;

    const systemPrompt = `You are a security and compliance expert reviewing customer contracts. Your task is to analyze security-related clauses and assess whether the organization can meet the requirements based on their documented capabilities.

ANALYSIS CATEGORIES:
- data_protection: Data handling, privacy, GDPR, personal data requirements
- security_controls: Technical security measures, encryption, access controls
- certifications: SOC 2, ISO 27001, PCI DSS, HIPAA compliance requirements
- incident_response: Breach notification, incident handling, response times
- audit_rights: Customer audit rights, third-party assessments, penetration testing
- subprocessors: Third-party/subcontractor requirements and approvals
- data_retention: Data storage duration, deletion requirements
- insurance: Cyber liability, professional liability coverage requirements
- liability: Limitation of liability, indemnification related to security
- confidentiality: NDA terms, information handling
- other: Other security or compliance related items

RATING SCALE:
- can_comply: The organization fully meets this requirement based on their documented capabilities
- partial: The organization partially meets this; may need adjustments or clarification
- gap: The organization does not currently support this requirement
- risk: This clause poses a potential risk or unreasonable obligation
- info_only: Informational clause, no specific action needed

YOUR CAPABILITIES (use these to assess compliance):
${skillsContext}

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "overallRating": "compliant" | "mostly_compliant" | "needs_review" | "high_risk",
  "summary": "Executive summary of the contract analysis (2-3 paragraphs)",
  "findings": [
    {
      "category": "category_name",
      "clauseText": "The exact or summarized clause text from the contract",
      "rating": "can_comply" | "partial" | "gap" | "risk" | "info_only",
      "rationale": "Why this rating was given, referencing your capabilities",
      "suggestedResponse": "Optional: How to respond or negotiate if needed"
    }
  ]
}

GUIDELINES:
1. Focus on security, privacy, and compliance clauses
2. Extract 5-20 key findings (don't list every clause, focus on important ones)
3. Be specific about which of your capabilities support each finding
4. For gaps or risks, suggest concrete responses or negotiation points
5. The overall rating should reflect the aggregate risk level
6. Return ONLY valid JSON, no markdown or explanatory text`;

    const userPrompt = `Analyze this ${contract.contractType || "contract"} from ${contract.customerName || "the customer"}:

---CONTRACT TEXT---
${contractText}
---END CONTRACT TEXT---

Identify and rate security-related clauses against our documented capabilities. Return your analysis as JSON.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
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
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: { contractId: id, skillCount: skills.length },
    });

    // Parse the JSON response
    let result: AnalysisResult;
    try {
      let jsonText = content.text.trim();
      // Extract JSON from markdown code blocks if present
      if (jsonText.startsWith("```")) {
        const lines = jsonText.split("\n");
        lines.shift();
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop();
        }
        jsonText = lines.join("\n");
      }
      result = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse LLM response:", content.text);
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

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      overallRating: updated.overallRating,
      summary: updated.summary,
      findings,
      analyzedAt: updated.analyzedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Contract analysis error:", error);

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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
