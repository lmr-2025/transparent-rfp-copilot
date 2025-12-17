import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import OktaProvider from "next-auth/providers/okta";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import { UserRole, Capability } from "@prisma/client";
import { mergeCapabilities, roleToCapabilities, getDefaultCapabilities } from "./capabilities";

// Build providers array conditionally
const providers: NextAuthOptions["providers"] = [];

// Only add Google provider if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Restrict to specific domain(s) if configured
      // Set GOOGLE_ALLOWED_DOMAINS=yourcompany.com or GOOGLE_ALLOWED_DOMAINS=company1.com,company2.com
      ...(process.env.GOOGLE_ALLOWED_DOMAINS && {
        authorization: {
          params: {
            hd: process.env.GOOGLE_ALLOWED_DOMAINS.split(",")[0], // hd param only supports one domain
          },
        },
      }),
    })
  );
}

// Add Okta provider if configured
if (process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER) {
  providers.push(
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER, // e.g., https://your-org.okta.com/oauth2/default
      // Request groups claim from Okta
      authorization: {
        params: {
          scope: "openid profile email groups",
        },
      },
    })
  );
}

// Dev-only: Add credentials provider for local testing without OAuth
if (process.env.NODE_ENV !== "production") {
  providers.push(
    CredentialsProvider({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          // Check if this will be the first user (make them admin)
          const userCount = await prisma.user.count();
          const isFirstUser = userCount === 0;
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split("@")[0],
              role: isFirstUser ? "ADMIN" : "USER",
              capabilities: isFirstUser
                ? roleToCapabilities("ADMIN")
                : getDefaultCapabilities(),
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          capabilities: user.capabilities,
        };
      },
    })
  );
}

/**
 * Compute capabilities from SSO groups
 * Looks up AuthGroupMapping table and merges with manual capabilities
 */
async function computeCapabilitiesFromGroups(
  userId: string,
  ssoGroups: string[],
  provider: string
): Promise<Capability[]> {
  // Get user's manual capabilities
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { manualCapabilities: true },
  });

  // If no SSO groups, use defaults + manual
  if (!ssoGroups || ssoGroups.length === 0) {
    return mergeCapabilities(getDefaultCapabilities(), user?.manualCapabilities);
  }

  // Look up group mappings
  const mappings = await prisma.authGroupMapping.findMany({
    where: {
      provider,
      groupId: { in: ssoGroups },
      isActive: true,
    },
    select: { capabilities: true },
  });

  // Merge all capabilities from matched groups
  const ssoCapabilities = mappings.flatMap((m) => m.capabilities);

  // If no mappings found, use defaults
  if (ssoCapabilities.length === 0) {
    return mergeCapabilities(getDefaultCapabilities(), user?.manualCapabilities);
  }

  // Merge SSO capabilities with manual overrides
  return mergeCapabilities(ssoCapabilities, user?.manualCapabilities);
}

/**
 * Extract groups from OAuth profile/token
 * Different providers use different claim names
 */
function extractGroupsFromProfile(profile: Record<string, unknown>): string[] {
  // Okta typically uses "groups" claim
  if (Array.isArray(profile.groups)) {
    return profile.groups as string[];
  }
  // Some providers use "memberOf"
  if (Array.isArray(profile.memberOf)) {
    return profile.memberOf as string[];
  }
  // Azure AD uses "roles" or custom claims
  if (Array.isArray(profile.roles)) {
    return profile.roles as string[];
  }
  return [];
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // On OAuth sign-in, extract groups and update user
      if (account && profile && user.id) {
        const ssoGroups = extractGroupsFromProfile(profile as Record<string, unknown>);
        const provider = account.provider;

        try {
          // Compute capabilities from SSO groups
          const capabilities = await computeCapabilitiesFromGroups(user.id, ssoGroups, provider);

          // Update user with latest SSO groups and computed capabilities
          await prisma.user.update({
            where: { id: user.id },
            data: {
              ssoGroups,
              capabilities,
            },
          });
        } catch (error) {
          // Log but don't block sign-in
          console.error("Error updating user capabilities:", error);
        }
      }
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole) || "USER";
        session.user.capabilities = (token.capabilities as Capability[]) || getDefaultCapabilities();
      }
      return session;
    },

    async jwt({ token, user, trigger, account, profile }) {
      if (user) {
        token.sub = user.id;

        // Get capabilities from user object or database
        if ((user as { capabilities?: Capability[] }).capabilities) {
          token.capabilities = (user as { capabilities?: Capability[] }).capabilities;
        } else {
          // Fetch from database
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { capabilities: true, role: true },
          });
          token.capabilities = dbUser?.capabilities || getDefaultCapabilities();
          token.role = dbUser?.role || "USER";
        }

        // Use role from user object if available (credentials provider passes it)
        if ((user as { role?: string }).role) {
          token.role = (user as { role?: string }).role as "ADMIN" | "USER";
        } else {
          // Fetch role from database for OAuth providers
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          });
          token.role = dbUser?.role || "USER";
        }
      }

      // On OAuth sign-in with profile, update capabilities
      if (account && profile && token.sub) {
        const ssoGroups = extractGroupsFromProfile(profile as Record<string, unknown>);
        const capabilities = await computeCapabilitiesFromGroups(token.sub, ssoGroups, account.provider);
        token.capabilities = capabilities;
      }

      // Refresh capabilities on session update
      if (trigger === "update" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, capabilities: true },
        });
        token.role = dbUser?.role || "USER";
        token.capabilities = dbUser?.capabilities || getDefaultCapabilities();
      }

      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
