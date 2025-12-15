import { prisma } from "@/lib/prisma";
import { createContextSnippetSchema } from "@/lib/validations";
import { logContextSnippetChange } from "@/lib/auditLog";
import {
  createRoute,
  apiSuccess,
  errors,
  parseAndValidate,
} from "@/lib/apiResponse";

// GET /api/context-snippets - List all context snippets
export const GET = createRoute(
  { auth: "authenticated", rateLimit: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active") !== "false";

    const snippets = await prisma.contextSnippet.findMany({
      where: {
        ...(category && { category }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return apiSuccess(snippets);
  }
);

// POST /api/context-snippets - Create a new context snippet
export const POST = createRoute(
  { auth: "authenticated", rateLimit: "standard" },
  async (request, context) => {
    const parsed = await parseAndValidate(request, createContextSnippetSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const data = parsed.data;

    // Check for duplicate key
    const existing = await prisma.contextSnippet.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      return errors.conflict(`A snippet with key "${data.key}" already exists`);
    }

    const snippet = await prisma.contextSnippet.create({
      data: {
        name: data.name,
        key: data.key,
        content: data.content,
        category: data.category,
        description: data.description,
        isActive: data.isActive,
        createdBy: context.userEmail,
      },
    });

    // Audit log
    await logContextSnippetChange(
      "CREATED",
      snippet.id,
      snippet.name,
      { id: context.userId, email: context.userEmail, name: context.userName },
      undefined,
      { key: data.key, category: data.category }
    );

    return apiSuccess(snippet, { status: 201 });
  }
);
