import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Feature flag route protection middleware
 *
 * Redirects users away from disabled feature routes.
 * Feature flags are read from environment variables.
 */

// Feature flags - read directly from env (can't import from lib in middleware edge runtime)
// Default to true (enabled) unless explicitly set to "false"
const features = {
  chat: process.env.NEXT_PUBLIC_FEATURE_CHAT_ENABLED !== "false",
  contracts: process.env.NEXT_PUBLIC_FEATURE_CONTRACTS_ENABLED !== "false",
  usage: process.env.NEXT_PUBLIC_FEATURE_USAGE_ENABLED !== "false",
  auditLog: process.env.NEXT_PUBLIC_FEATURE_AUDIT_LOG_ENABLED !== "false",
};

// Routes that require feature flags
const protectedRoutes: Record<string, keyof typeof features> = {
  "/chat": "chat",
  "/contracts": "contracts",
  "/usage": "usage",
  "/audit-log": "auditLog",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const start = Date.now();

  // Check if this route is feature-flagged
  for (const [route, feature] of Object.entries(protectedRoutes)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (!features[feature]) {
        // Redirect to projects page if feature is disabled
        const url = request.nextUrl.clone();
        url.pathname = "/projects";
        return NextResponse.redirect(url);
      }
    }
  }

  const response = NextResponse.next();

  // Add Server-Timing header for observability
  const duration = Date.now() - start;
  response.headers.set('Server-Timing', `middleware;dur=${duration}`);

  // Log slow requests (>500ms) for monitoring
  if (pathname.startsWith('/api/') && duration > 500) {
    console.warn(`⚠️ Slow API route: ${pathname} took ${duration}ms`);
  }

  return response;
}

// Run middleware on app routes AND API routes for performance monitoring
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     *
     * Now includes /api/* for slow query logging
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
  ],
};
