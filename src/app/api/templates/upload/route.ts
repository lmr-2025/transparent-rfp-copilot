import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import * as mammoth from "mammoth";
import { parsePlaceholders, extractPlaceholderHints } from "@/lib/templateEngine";

/**
 * POST /api/templates/upload
 * Parse uploaded file (DOCX, MD, TXT) and extract content + placeholders
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errors.badRequest("No file provided");
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split(".").pop();
    const allowedExtensions = ["docx", "md", "txt", "markdown"];

    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return errors.badRequest(
        `Unsupported file type. Allowed: ${allowedExtensions.join(", ")}`
      );
    }

    // Extract content based on file type
    let content: string;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (fileExt === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      // MD and TXT are plain text
      content = buffer.toString("utf-8");
    }

    if (!content || content.trim().length === 0) {
      return errors.badRequest("File appears to be empty");
    }

    // Parse placeholders from content
    const placeholders = parsePlaceholders(content);
    const placeholderHints = extractPlaceholderHints(content);

    // Extract sections (headers) from content
    const sections = extractSections(content);

    // Generate suggested name from filename
    const suggestedName = fileName
      .replace(/\.(docx|md|txt|markdown)$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();

    // Determine suggested category based on content/name
    const suggestedCategory = inferCategory(content, suggestedName);

    logger.info("Template file parsed", {
      fileName: file.name,
      fileSize: file.size,
      contentLength: content.length,
      placeholderCount: placeholders.length,
      sectionCount: sections.length,
    });

    return apiSuccess({
      content,
      placeholders: placeholders.map((p) => ({
        match: p.fullMatch,
        type: p.type,
        field: p.field,
        hint: placeholderHints[p.fullMatch] || null,
      })),
      suggestedName,
      suggestedCategory,
      sections,
      stats: {
        charCount: content.length,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        lineCount: content.split("\n").length,
        placeholderCount: placeholders.length,
      },
    });
  } catch (error) {
    logger.error("Failed to parse template file", error);
    return errors.internal("Failed to parse template file");
  }
}

/**
 * Extract section headers from content
 */
function extractSections(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Markdown headers
    if (/^#{1,4}\s+/.test(trimmed)) {
      sections.push(trimmed.replace(/^#+\s+/, ""));
    }
    // All caps headers (common in DOCX)
    else if (/^[A-Z][A-Z\s]{5,}$/.test(trimmed) && trimmed.length < 100) {
      sections.push(trimmed);
    }
    // Headers followed by underlines
    else if (
      trimmed.length > 0 &&
      trimmed.length < 100 &&
      lines[lines.indexOf(line) + 1]?.match(/^[=-]+$/)
    ) {
      sections.push(trimmed);
    }
  }

  return sections;
}

/**
 * Infer template category from content and name
 */
function inferCategory(content: string, name: string): string | null {
  const combined = `${name} ${content}`.toLowerCase();

  if (
    combined.includes("battlecard") ||
    combined.includes("battle card") ||
    combined.includes("competitor")
  ) {
    return "battlecards";
  }
  if (
    combined.includes("proposal") ||
    combined.includes("rfp") ||
    combined.includes("request for proposal")
  ) {
    return "proposals";
  }
  if (
    combined.includes("presentation") ||
    combined.includes("deck") ||
    combined.includes("slide")
  ) {
    return "presentations";
  }
  if (
    combined.includes("report") ||
    combined.includes("analysis") ||
    combined.includes("summary")
  ) {
    return "reports";
  }
  if (
    combined.includes("sale") ||
    combined.includes("pitch") ||
    combined.includes("one-pager") ||
    combined.includes("one pager")
  ) {
    return "sales";
  }

  return null;
}
