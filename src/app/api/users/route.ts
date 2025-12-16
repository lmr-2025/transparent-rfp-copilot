import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiSuccess, errors } from "@/lib/apiResponse";

// GET /api/users - List all users (for owner selection dropdowns)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Only authenticated users can list users
    if (!session?.user) {
      return errors.unauthorized();
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ users });
  } catch (error) {
    logger.error("Failed to fetch users", error, { route: "/api/users" });
    return errors.internal("Failed to fetch users");
  }
}
