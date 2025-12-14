import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type AuthResult =
  | { authorized: true; session: { user: { id: string; role: string; email?: string; name?: string } } }
  | { authorized: false; response: NextResponse };

/**
 * Require authentication for an API route.
 * Returns the session if authenticated, or an error response to return.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session: {
      user: {
        id: session.user.id,
        role: session.user.role || "USER",
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      },
    },
  };
}

/**
 * Require admin role for an API route.
 * Returns the session if admin, or an error response to return.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const role = authResult.session.user.role;
  if (role !== "ADMIN" && role !== "PROMPT_ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
