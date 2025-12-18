import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { getModel } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import {
  fillTemplate,
  buildLLMFillPrompt,
  parsePlaceholders,
} from "@/lib/templateEngine";
import { markdownToDocxBase64 } from "@/lib/docxExport";
import type { TemplateFillContext } from "@/types/template";

export const maxDuration = 60;

// Validation schema for fill request
const fillTemplateSchema = z.object({
  templateId: z.string().uuid(),
  context: z.object({
    customer: z
      .object({
        id: z.string(),
        name: z.string(),
        industry: z.string().optional(),
        region: z.string().optional(),
        tier: z.string().optional(),
        content: z.string().optional(),
        considerations: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    gtm: z
      .object({
        gongCalls: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              date: z.string(),
              summary: z.string().optional(),
              participants: z.array(z.string()),
            })
          )
          .optional(),
        hubspotActivities: z
          .array(
            z.object({
              id: z.string(),
              type: z.string(),
              date: z.string(),
              subject: z.string(),
              content: z.string().optional(),
            })
          )
          .optional(),
        lookerMetrics: z
          .array(
            z.object({
              period: z.string(),
              metrics: z.record(z.string(), z.union([z.string(), z.number()])),
            })
          )
          .optional(),
      })
      .optional(),
    skills: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          content: z.string(),
        })
      )
      .optional(),
    custom: z.record(z.string(), z.string()).optional(),
  }),
  outputFormat: z.enum(["markdown", "docx"]).optional().default("markdown"),
});

// POST /api/templates/fill - Fill a template with context
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = validateBody(fillTemplateSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { templateId, context, outputFormat } = validation.data;

    // Fetch the template
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return errors.notFound("Template not found");
    }

    if (!template.isActive) {
      return errors.badRequest("Template is not active");
    }

    // Fill non-LLM placeholders
    const fillResult = fillTemplate(
      template.content,
      context as TemplateFillContext
    );

    let finalContent = fillResult.content;
    const llmGeneratedSections: string[] = [];

    // If there are LLM placeholders, use the LLM to fill them
    if (fillResult.llmPlaceholders.length > 0) {
      const anthropic = getAnthropicClient();
      const model = getModel("quality");

      const llmPrompt = buildLLMFillPrompt(
        fillResult.content,
        fillResult.llmPlaceholders,
        context as TemplateFillContext
      );

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: "user", content: llmPrompt }],
      });

      const responseContent = response.content[0];
      if (responseContent.type === "text") {
        finalContent = responseContent.text;
        llmGeneratedSections.push(
          ...fillResult.llmPlaceholders.map((p) => p.fullMatch)
        );
      }

      // Log usage
      logUsage({
        userId: session.user.id,
        userEmail: session.user.email,
        feature: "template_fill",
        model,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        metadata: {
          templateId,
          templateName: template.name,
          llmPlaceholderCount: fillResult.llmPlaceholders.length,
          outputFormat,
        },
      });
    }

    // Check for any remaining unresolved placeholders
    const remainingPlaceholders = parsePlaceholders(finalContent);
    const stillMissing = remainingPlaceholders.map((p) => p.fullMatch);

    // Handle DOCX output format
    let docxBase64: string | undefined;
    if (outputFormat === "docx") {
      try {
        docxBase64 = await markdownToDocxBase64(finalContent, {
          title: template.name,
          author: session.user.email || "RFP Copilot",
        });
        logger.info("DOCX generated successfully", {
          templateId,
          templateName: template.name,
        });
      } catch (docxError) {
        logger.error("Failed to generate DOCX", docxError);
        // Fall back to markdown if DOCX generation fails
      }
    }

    return apiSuccess({
      filledContent: finalContent,
      outputFormat: docxBase64 ? "docx" : "markdown",
      docxBase64, // Base64-encoded DOCX file for download
      placeholdersUsed: fillResult.placeholdersResolved,
      placeholdersMissing: [...fillResult.placeholdersMissing, ...stillMissing],
      llmGeneratedSections,
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
      },
    });
  } catch (error) {
    logger.error("Failed to fill template", error);
    return errors.internal("Failed to fill template");
  }
}
