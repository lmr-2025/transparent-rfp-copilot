import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import OktaProvider from "next-auth/providers/okta";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import { UserRole } from "@prisma/client";

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
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split("@")[0],
              role: userCount === 0 ? "ADMIN" : "USER",
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    })
  );
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
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole) || "USER";
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;

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
      // Refresh role on session update
      if (trigger === "update" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });
        token.role = dbUser?.role || "USER";
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
