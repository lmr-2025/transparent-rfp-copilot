import { NextAuthOptions } from "next-auth";
// Note: PrismaAdapter removed - we use JWT strategy and handle user creation manually
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
      // Allow linking Google account to existing user with same email
      // This is needed when user was created via dev login or another method
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // Request offline access for refresh tokens
          access_type: "offline",
          prompt: "consent",
          // Include Slides and Drive scopes for template filling
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/presentations", // Read/write slides
            "https://www.googleapis.com/auth/drive.readonly", // List all presentations
            "https://www.googleapis.com/auth/drive.file", // Create/edit files (needed to copy presentations)
          ].join(" "),
          // Restrict to specific domain(s) if configured
          ...(process.env.GOOGLE_ALLOWED_DOMAINS && {
            hd: process.env.GOOGLE_ALLOWED_DOMAINS.split(",")[0],
          }),
        },
      },
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
  // Get user's existing capabilities and manual overrides
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { capabilities: true, manualCapabilities: true },
  });

  // If no SSO groups (e.g., Google auth without group claims), preserve existing capabilities
  // Only apply defaults for brand new users with no capabilities yet
  if (!ssoGroups || ssoGroups.length === 0) {
    const existingCaps = user?.capabilities || [];
    if (existingCaps.length > 0) {
      // User already has capabilities - preserve them, merge with any manual overrides
      return mergeCapabilities(existingCaps, user?.manualCapabilities);
    }
    // New user with no capabilities - use defaults + manual
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
  // NOTE: No adapter - we use JWT strategy and handle user creation manually
  // This avoids issues with PrismaAdapter account linking
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production", // Enable debug logging
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // On OAuth sign-in, find or create user and update capabilities
      if (account && profile && user.email) {
        const ssoGroups = extractGroupsFromProfile(profile as Record<string, unknown>);
        const provider = account.provider;

        try {
          // Find or create user by email
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, capabilities: true, manualCapabilities: true },
          });

          if (!dbUser) {
            // Create new user - first user gets admin
            const userCount = await prisma.user.count();
            const isFirstUser = userCount === 0;

            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                image: (user as { image?: string }).image,
                role: isFirstUser ? "ADMIN" : "USER",
                capabilities: isFirstUser
                  ? roleToCapabilities("ADMIN")
                  : getDefaultCapabilities(),
              },
              select: { id: true, capabilities: true, manualCapabilities: true },
            });
          }

          // Compute capabilities from SSO groups
          const capabilities = await computeCapabilitiesFromGroups(dbUser.id, ssoGroups, provider);

          // Update user with latest SSO groups, capabilities, and profile info
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              ssoGroups,
              capabilities,
              name: user.name || undefined,
              image: (user as { image?: string }).image || undefined,
            },
          });

          // Store OAuth tokens in Account table for API access (e.g., Google Slides)
          // This replaces what PrismaAdapter would normally do
          if (account.access_token) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                access_token: account.access_token,
                refresh_token: account.refresh_token || undefined,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
              create: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            });
          }
        } catch (error) {
          // Log but don't block sign-in
          console.error("Error in signIn callback:", error);
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

    async jwt({ token, user, trigger }) {
      try {
        // For OAuth providers, always fetch user data from database by email
        // This avoids issues where user.id might not match the database ID
        const email = user?.email || token.email;

        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: email as string },
            select: { id: true, capabilities: true, role: true },
          });

          if (dbUser) {
            // Always use the database user ID as the token subject
            token.sub = dbUser.id;
            token.capabilities = dbUser.capabilities.length > 0
              ? dbUser.capabilities
              : getDefaultCapabilities();
            token.role = dbUser.role || "USER";
          } else {
            // User not in database yet - use defaults
            // This can happen briefly before PrismaAdapter creates the user
            if (user) {
              token.sub = user.id;
            }
            token.capabilities = getDefaultCapabilities();
            token.role = "USER";
          }
        }

        // Refresh capabilities on session update
        if (trigger === "update" && token.sub) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, capabilities: true },
          });
          if (dbUser) {
            token.role = dbUser.role || "USER";
            token.capabilities = dbUser.capabilities.length > 0
              ? dbUser.capabilities
              : getDefaultCapabilities();
          }
        }
      } catch (error) {
        console.error("Error in jwt callback:", error);
        // Don't fail sign-in, just use defaults
        token.capabilities = getDefaultCapabilities();
        token.role = "USER";
      }

      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
