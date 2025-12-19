import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Feature flag route protection middleware
 *
 * Redirects users away from disabled feature routes.
 * Feature flags are read from environment variables.
 */

// Feature flags - read directly from env (can't import from lib in middleware edge runtime)
const features = {
  chat: process.env.NEXT_PUBLIC_FEATURE_CHAT_ENABLED !== "false",
  usage: process.env.NEXT_PUBLIC_FEATURE_USAGE_ENABLED !== "false",
  auditLog: process.env.NEXT_PUBLIC_FEATURE_AUDIT_LOG_ENABLED !== "false",
};

// Routes that require feature flags
const protectedRoutes: Record<string, keyof typeof features> = {
  "/chat": "chat",
  "/usage": "usage",
  "/audit-log": "auditLog",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

// Only run middleware on app routes (not api, static files, etc.)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
  ],
};
