/**
 * Standardized API Response Utilities
 *
 * This file provides consistent patterns for:
 * - Error responses with structured error codes
 * - Success responses with optional pagination/transparency
 * - Request validation with detailed error info
 * - Composable route middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { requireAuth, requireAdmin } from "@/lib/apiAuth";
import { checkRateLimit, getRateLimitIdentifier, rateLimitConfigs } from "@/lib/rateLimit";

// ============================================
// ERROR TYPES AND RESPONSES
// ============================================

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Create a standardized error response
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const status = ERROR_STATUS_CODES[code];
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

// Convenience error creators
export const errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    apiError("VALIDATION_ERROR", message, details),

  badRequest: (message: string) =>
    apiError("BAD_REQUEST", message),

  unauthorized: (message = "Authentication required") =>
    apiError("AUTHENTICATION_ERROR", message),

  forbidden: (message = "You don't have permission to access this resource") =>
    apiError("AUTHORIZATION_ERROR", message),

  notFound: (resource = "Resource") =>
    apiError("NOT_FOUND", `${resource} not found`),

  conflict: (message: string) =>
    apiError("CONFLICT", message),

  internal: (message = "An internal error occurred") =>
    apiError("INTERNAL_ERROR", message),
};

// ============================================
// SUCCESS RESPONSES
// ============================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransparencyMeta {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  pagination?: PaginationMeta;
  transparency?: TransparencyMeta;
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    pagination?: PaginationMeta;
    transparency?: TransparencyMeta;
    headers?: Record<string, string>;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = { data };

  if (options?.pagination) {
    response.pagination = options.pagination;
  }

  if (options?.transparency) {
    response.transparency = options.transparency;
  }

  return NextResponse.json(response, {
    status: options?.status ?? 200,
    headers: options?.headers,
  });
}

// ============================================
// REQUEST VALIDATION
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * Validate request data against a Zod schema with detailed error info
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Parse and validate JSON body from request
 */
export async function parseAndValidate<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: errors.validation("Invalid JSON body"),
    };
  }

  const validation = validateRequest(schema, body);

  if (!validation.success) {
    return {
      success: false,
      response: errors.validation("Validation failed", { errors: validation.errors }),
    };
  }

  return { success: true, data: validation.data };
}

// ============================================
// ROUTE MIDDLEWARE / COMPOSABLE HANDLERS
// ============================================

export type AuthLevel = "public" | "authenticated" | "admin";
export type RateLimitType = keyof typeof rateLimitConfigs;

export interface RouteConfig {
  /** Authentication level required */
  auth: AuthLevel;
  /** Rate limit configuration (optional) */
  rateLimit?: RateLimitType;
}

export interface RouteContext {
  /** The authenticated user's session (if auth !== 'public') */
  userId?: string;
  userEmail?: string | null;
  userName?: string | null;
}

type RouteHandler<T = unknown> = (
  request: NextRequest,
  context: RouteContext,
  params?: T
) => Promise<NextResponse>;

/**
 * Create a route handler with standardized middleware
 *
 * @example
 * ```ts
 * export const POST = createRoute(
 *   { auth: "authenticated", rateLimit: "standard" },
 *   async (request, context) => {
 *     const { data } = await parseAndValidate(request, createSkillSchema);
 *     const skill = await createSkill(data);
 *     return apiSuccess(skill, { status: 201 });
 *   }
 * );
 * ```
 */
export function createRoute<TParams = unknown>(
  config: RouteConfig,
  handler: RouteHandler<TParams>
): (request: NextRequest, options?: { params: Promise<TParams> }) => Promise<NextResponse> {
  return async (request: NextRequest, options?: { params: Promise<TParams> }) => {
    const routeContext: RouteContext = {};

    // 1. Authentication
    if (config.auth === "admin") {
      const auth = await requireAdmin();
      if (!auth.authorized) {
        return auth.response;
      }
      if (auth.session?.user) {
        routeContext.userId = auth.session.user.id;
        routeContext.userEmail = auth.session.user.email;
        routeContext.userName = auth.session.user.name;
      }
    } else if (config.auth === "authenticated") {
      const auth = await requireAuth();
      if (!auth.authorized) {
        return auth.response;
      }
      if (auth.session?.user) {
        routeContext.userId = auth.session.user.id;
        routeContext.userEmail = auth.session.user.email;
        routeContext.userName = auth.session.user.name;
      }
    }
    // 'public' - no auth check

    // 2. Rate limiting
    if (config.rateLimit) {
      const identifier = await getRateLimitIdentifier(request);
      const result = await checkRateLimit(identifier, config.rateLimit);

      if (!result.success && result.error) {
        return result.error;
      }
    }

    // 3. Resolve params if provided
    const params = options?.params ? await options.params : undefined;

    // 4. Call handler
    try {
      return await handler(request, routeContext, params as TParams);
    } catch (error) {
      console.error("Route handler error:", error);
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      return errors.internal(message);
    }
  };
}

// ============================================
// PAGINATION HELPERS
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Parse pagination params from URL search params
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { page: 1, limit: 50, maxLimit: 100 }
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || String(defaults.page), 10));
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaults.limit), 10))
  );
  return { page, limit };
}

/**
 * Create pagination metadata
 */
export function createPagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
