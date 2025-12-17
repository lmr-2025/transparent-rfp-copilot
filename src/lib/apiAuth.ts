import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { Capability } from "@prisma/client";
import { hasCapability, hasAnyCapability } from "./capabilities";

export type AuthResult =
  | {
      authorized: true;
      session: {
        user: {
          id: string;
          role: string;
          email?: string;
          name?: string;
          capabilities: Capability[];
        };
      };
    }
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
        capabilities: session.user.capabilities || [],
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

  const { capabilities, role } = authResult.session.user;

  // Check capabilities first (new system)
  if (capabilities.length > 0) {
    if (!hasAnyCapability(capabilities, ["ADMIN", "MANAGE_PROMPTS"])) {
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

  // Fall back to legacy role check
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

/**
 * Require a specific capability for an API route.
 */
export async function requireCapability(capability: Capability): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const { capabilities } = authResult.session.user;

  if (!hasCapability(capabilities, capability)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `${capability} capability required` },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Require any of the specified capabilities for an API route.
 */
export async function requireAnyCapability(requiredCapabilities: Capability[]): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const { capabilities } = authResult.session.user;

  if (!hasAnyCapability(capabilities, requiredCapabilities)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `One of ${requiredCapabilities.join(", ")} capabilities required` },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
