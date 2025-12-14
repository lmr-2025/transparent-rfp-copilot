import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDailyUsage } from "@/lib/usageTracking";

// GET /api/usage - Get usage statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);
    const scope = searchParams.get("scope") || "user"; // "user" or "all" (admin only)
    const feature = searchParams.get("feature"); // Optional filter

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();

    // Build where clause
    const where: {
      createdAt: { gte: Date; lte: Date };
      userId?: string | null;
      feature?: string;
    } = {
      createdAt: { gte: startDate, lte: endDate },
    };

    // Filter by user if not admin scope
    if (scope === "user" && session?.user?.id) {
      where.userId = session.user.id;
    } else if (scope === "user") {
      // Anonymous user - show nothing
      return NextResponse.json({
        summary: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          callCount: 0,
        },
        byFeature: [],
        daily: [],
        recentCalls: [],
      });
    }

    if (feature) {
      where.feature = feature;
    }

    // Get aggregated stats
    const aggregated = await prisma.apiUsage.aggregate({
      where,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCost: true,
      },
      _count: true,
    });

    // Get breakdown by feature
    const byFeature = await prisma.apiUsage.groupBy({
      by: ["feature"],
      where,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCost: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          totalTokens: "desc",
        },
      },
    });

    // Get daily breakdown
    const dailyUsage = await getDailyUsage(
      scope === "user" && session?.user?.id ? session.user.id : undefined,
      days
    );

    // Get recent calls (last 20)
    const recentCalls = await prisma.apiUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        feature: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCost: true,
        createdAt: true,
        userEmail: true,
      },
    });

    return NextResponse.json({
      summary: {
        totalInputTokens: aggregated._sum.inputTokens || 0,
        totalOutputTokens: aggregated._sum.outputTokens || 0,
        totalTokens: aggregated._sum.totalTokens || 0,
        totalCost: aggregated._sum.estimatedCost || 0,
        callCount: aggregated._count,
      },
      byFeature: byFeature.map((item) => ({
        feature: item.feature,
        inputTokens: item._sum.inputTokens || 0,
        outputTokens: item._sum.outputTokens || 0,
        totalTokens: item._sum.totalTokens || 0,
        totalCost: item._sum.estimatedCost || 0,
        callCount: item._count,
      })),
      daily: dailyUsage,
      recentCalls: recentCalls.map((call) => ({
        ...call,
        createdAt: call.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching usage data:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }
}
