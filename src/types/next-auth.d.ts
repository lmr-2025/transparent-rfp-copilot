import { DefaultSession } from "next-auth";
import { UserRole, Capability } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      capabilities: Capability[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    capabilities?: Capability[];
  }
}
