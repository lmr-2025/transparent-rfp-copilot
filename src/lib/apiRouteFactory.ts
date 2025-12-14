import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { validateBody, ValidationSchema } from "@/lib/validations";
import { getUserFromSession, AuditUser } from "@/lib/auditLog";

// Generic types for factory
type PrismaModel = keyof typeof prisma & string;

// Route handler types
type RouteContext = {
  params: Promise<{ id: string }>;
};

// Generic error response
function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

// Success response wrapper
function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

// ============================================
// List Route Factory (GET /api/[resource])
// ============================================
type ListConfig<T> = {
  model: PrismaModel;
  // Transform query params to prisma where clause
  buildWhere?: (params: URLSearchParams) => Record<string, unknown>;
  // Select specific fields (omit large content fields)
  select?: Record<string, boolean>;
  // Include relations
  include?: Record<string, unknown>;
  // Default ordering
  orderBy?: Record<string, "asc" | "desc">;
  // Transform results before returning
  transform?: (items: T[]) => unknown;
  // Wrap result in object with key
  resultKey?: string;
};

export function createListHandler<T>(config: ListConfig<T>) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const where = config.buildWhere?.(searchParams) ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (prisma as any)[config.model];

      const items = await modelDelegate.findMany({
        where,
        ...(config.select && { select: config.select }),
        ...(config.include && { include: config.include }),
        orderBy: config.orderBy ?? { updatedAt: "desc" },
      });

      const result = config.transform ? config.transform(items) : items;

      if (config.resultKey) {
        return successResponse({ [config.resultKey]: result });
      }
      return successResponse(result);
    } catch (error) {
      console.error(`Failed to fetch ${config.model}:`, error);
      return errorResponse(`Failed to fetch ${config.model}`);
    }
  };
}

// ============================================
// Create Route Factory (POST /api/[resource])
// ============================================
type CreateConfig<TInput, TOutput> = {
  model: PrismaModel;
  // Validation schema
  schema: ValidationSchema<TInput>;
  // Transform validated data to prisma create input
  buildData: (data: TInput, auth: { session: { user: { id: string; email?: string | null; name?: string | null } } }) => Record<string, unknown>;
  // Optional audit logging
  auditLog?: (item: TOutput, user: AuditUser, data: TInput) => Promise<void>;
  // Wrap result in object with key
  resultKey?: string;
  // Include relations in response
  include?: Record<string, unknown>;
};

export function createCreateHandler<TInput, TOutput>(config: CreateConfig<TInput, TOutput>) {
  return async function POST(request: NextRequest) {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    try {
      const body = await request.json();

      const validation = validateBody(config.schema, body);
      if (!validation.success) {
        return errorResponse(validation.error, 400);
      }

      const data = validation.data as TInput;
      const createData = config.buildData(data, auth);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (prisma as any)[config.model];

      const item = await modelDelegate.create({
        data: createData,
        ...(config.include && { include: config.include }),
      });

      // Audit log if configured
      if (config.auditLog) {
        await config.auditLog(item, getUserFromSession(auth.session), data);
      }

      if (config.resultKey) {
        return successResponse({ [config.resultKey]: item }, 201);
      }
      return successResponse(item, 201);
    } catch (error) {
      console.error(`Failed to create ${config.model}:`, error);
      return errorResponse(`Failed to create ${config.model}`);
    }
  };
}

// ============================================
// Get By ID Route Factory (GET /api/[resource]/[id])
// ============================================
type GetByIdConfig<T> = {
  model: PrismaModel;
  // Select specific fields
  select?: Record<string, boolean>;
  // Include relations
  include?: Record<string, unknown>;
  // Transform result
  transform?: (item: T) => unknown;
  // Wrap result in object with key
  resultKey?: string;
  // Not found message
  notFoundMessage?: string;
};

export function createGetByIdHandler<T>(config: GetByIdConfig<T>) {
  return async function GET(_request: NextRequest, context: RouteContext) {
    try {
      const { id } = await context.params;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (prisma as any)[config.model];

      const item = await modelDelegate.findUnique({
        where: { id },
        ...(config.select && { select: config.select }),
        ...(config.include && { include: config.include }),
      });

      if (!item) {
        return errorResponse(config.notFoundMessage ?? "Not found", 404);
      }

      const result = config.transform ? config.transform(item) : item;

      if (config.resultKey) {
        return successResponse({ [config.resultKey]: result });
      }
      return successResponse(result);
    } catch (error) {
      console.error(`Failed to fetch ${config.model}:`, error);
      return errorResponse(`Failed to fetch ${config.model}`);
    }
  };
}

// ============================================
// Update Route Factory (PUT/PATCH /api/[resource]/[id])
// ============================================
type UpdateConfig<TInput, TOutput> = {
  model: PrismaModel;
  // Validation schema (optional - if not provided, accepts any body)
  schema?: ValidationSchema<TInput>;
  // Transform validated data to prisma update input
  buildData: (data: TInput, existing: TOutput, auth: { session: { user: { id: string; email?: string | null; name?: string | null } } }) => Record<string, unknown>;
  // Optional audit logging
  auditLog?: (item: TOutput, user: AuditUser, oldItem: TOutput, data: TInput) => Promise<void>;
  // Wrap result in object with key
  resultKey?: string;
  // Include relations in response
  include?: Record<string, unknown>;
  // Not found message
  notFoundMessage?: string;
};

export function createUpdateHandler<TInput, TOutput>(config: UpdateConfig<TInput, TOutput>) {
  return async function PUT(request: NextRequest, context: RouteContext) {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    try {
      const { id } = await context.params;
      const body = await request.json();

      // Validate if schema provided
      let data: TInput;
      if (config.schema) {
        const validation = validateBody(config.schema, body);
        if (!validation.success) {
          return errorResponse(validation.error, 400);
        }
        data = validation.data as TInput;
      } else {
        data = body as TInput;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (prisma as any)[config.model];

      // Get existing item for audit log
      const existing = await modelDelegate.findUnique({
        where: { id },
        ...(config.include && { include: config.include }),
      });

      if (!existing) {
        return errorResponse(config.notFoundMessage ?? "Not found", 404);
      }

      const updateData = config.buildData(data, existing, auth);

      const item = await modelDelegate.update({
        where: { id },
        data: updateData,
        ...(config.include && { include: config.include }),
      });

      // Audit log if configured
      if (config.auditLog) {
        await config.auditLog(item, getUserFromSession(auth.session), existing, data);
      }

      if (config.resultKey) {
        return successResponse({ [config.resultKey]: item });
      }
      return successResponse(item);
    } catch (error) {
      console.error(`Failed to update ${config.model}:`, error);
      return errorResponse(`Failed to update ${config.model}`);
    }
  };
}

// ============================================
// Delete Route Factory (DELETE /api/[resource]/[id])
// ============================================
type DeleteConfig<TOutput> = {
  model: PrismaModel;
  // Optional audit logging
  auditLog?: (item: TOutput, user: AuditUser) => Promise<void>;
  // Success message
  successMessage?: string;
  // Not found message
  notFoundMessage?: string;
};

export function createDeleteHandler<TOutput>(config: DeleteConfig<TOutput>) {
  return async function DELETE(_request: NextRequest, context: RouteContext) {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    try {
      const { id } = await context.params;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (prisma as any)[config.model];

      // Get existing item for audit log
      const existing = await modelDelegate.findUnique({
        where: { id },
      });

      if (!existing) {
        return errorResponse(config.notFoundMessage ?? "Not found", 404);
      }

      await modelDelegate.delete({
        where: { id },
      });

      // Audit log if configured
      if (config.auditLog) {
        await config.auditLog(existing, getUserFromSession(auth.session));
      }

      return successResponse({
        success: true,
        message: config.successMessage ?? "Deleted successfully",
      });
    } catch (error) {
      console.error(`Failed to delete ${config.model}:`, error);
      return errorResponse(`Failed to delete ${config.model}`);
    }
  };
}

// ============================================
// Combined CRUD Factory
// ============================================
type CrudConfig<TInput, TOutput> = {
  model: PrismaModel;
  resourceName: string;
  // List config
  list?: {
    buildWhere?: (params: URLSearchParams) => Record<string, unknown>;
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    transform?: (items: TOutput[]) => unknown;
  };
  // Create config
  create?: {
    schema: ValidationSchema<TInput>;
    buildData: (data: TInput, auth: { session: { user: { id: string; email?: string | null; name?: string | null } } }) => Record<string, unknown>;
    auditLog?: (item: TOutput, user: AuditUser, data: TInput) => Promise<void>;
  };
  // Get by ID config
  getById?: {
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
    transform?: (item: TOutput) => unknown;
  };
  // Update config
  update?: {
    schema?: ValidationSchema<TInput>;
    buildData: (data: TInput, existing: TOutput, auth: { session: { user: { id: string; email?: string | null; name?: string | null } } }) => Record<string, unknown>;
    auditLog?: (item: TOutput, user: AuditUser, oldItem: TOutput, data: TInput) => Promise<void>;
  };
  // Delete config
  delete?: {
    auditLog?: (item: TOutput, user: AuditUser) => Promise<void>;
  };
  // Common config
  resultKey?: string;
};

export function createCrudHandlers<TInput, TOutput>(config: CrudConfig<TInput, TOutput>) {
  const handlers: {
    GET?: (request: NextRequest) => Promise<NextResponse>;
    POST?: (request: NextRequest) => Promise<NextResponse>;
    getById?: (request: NextRequest, context: RouteContext) => Promise<NextResponse>;
    PUT?: (request: NextRequest, context: RouteContext) => Promise<NextResponse>;
    DELETE?: (request: NextRequest, context: RouteContext) => Promise<NextResponse>;
  } = {};

  if (config.list) {
    handlers.GET = createListHandler<TOutput>({
      model: config.model,
      ...config.list,
      resultKey: config.resultKey,
    });
  }

  if (config.create) {
    handlers.POST = createCreateHandler<TInput, TOutput>({
      model: config.model,
      ...config.create,
      resultKey: config.resultKey,
    });
  }

  if (config.getById) {
    handlers.getById = createGetByIdHandler<TOutput>({
      model: config.model,
      ...config.getById,
      resultKey: config.resultKey,
      notFoundMessage: `${config.resourceName} not found`,
    });
  }

  if (config.update) {
    handlers.PUT = createUpdateHandler<TInput, TOutput>({
      model: config.model,
      ...config.update,
      resultKey: config.resultKey,
      notFoundMessage: `${config.resourceName} not found`,
    });
  }

  if (config.delete) {
    handlers.DELETE = createDeleteHandler<TOutput>({
      model: config.model,
      ...config.delete,
      successMessage: `${config.resourceName} deleted successfully`,
      notFoundMessage: `${config.resourceName} not found`,
    });
  }

  return handlers;
}
