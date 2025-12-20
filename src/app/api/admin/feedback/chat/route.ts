import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/admin/feedback/chat - Get all chat feedback (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    // Check for admin access
    const userCapabilities = session.user.capabilities || [];
    const isAdmin = userCapabilities.includes("ADMIN") ||
      userCapabilities.includes("MANAGE_PROMPTS") ||
      (session.user as { role?: string }).role === "ADMIN";

    if (!isAdmin) {
      return errors.forbidden("Admin access required");
    }

    const feedbacks = await prisma.chatFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100
    });

    // Fetch user info for each feedback
    const userIds = [...new Set(feedbacks.map(f => f.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Attach user info to feedbacks
    const feedbacksWithUsers = feedbacks.map(fb => ({
      ...fb,
      user: userMap.get(fb.userId) || null,
    }));

    return apiSuccess({ feedbacks: feedbacksWithUsers });
  } catch (error) {
    logger.error("Error fetching admin chat feedback", error, { route: "/api/admin/feedback/chat" });
    return errors.internal("Failed to fetch feedback");
  }
}
