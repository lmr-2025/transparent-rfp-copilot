import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CustomerProfileHistoryEntry } from "@/types/customerProfile";
import { requireAuth } from "@/lib/apiAuth";
import { updateCustomerSchema, validateBody } from "@/lib/validations";
import { logCustomerChange, getUserFromSession, computeChanges } from "@/lib/auditLog";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/customers/[id] - Get single customer profile
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;

    const profile = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Customer profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer profile" },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update customer profile
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();

    const validation = validateBody(updateCustomerSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      name,
      industry,
      website,
      overview,
      products,
      challenges,
      keyFacts,
      sourceUrls,
      isActive,
      owners,
    } = validation.data;

    // lastRefreshedAt comes from body directly (not in schema - it's a system field)
    const lastRefreshedAt = body.lastRefreshedAt;

    // Get existing profile to append to history and compute changes
    const existing = await prisma.customerProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer profile not found" },
        { status: 404 }
      );
    }

    // Build history entry
    const historyEntry: CustomerProfileHistoryEntry = {
      date: new Date().toISOString(),
      action: lastRefreshedAt ? "refreshed" : "updated",
      summary: lastRefreshedAt
        ? "Profile refreshed from sources"
        : "Profile updated",
      user: auth.session.user.email,
    };

    const existingHistory = (existing.history as CustomerProfileHistoryEntry[]) || [];

    const profile = await prisma.customerProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(industry !== undefined && { industry: industry || null }),
        ...(website !== undefined && { website: website || null }),
        ...(overview !== undefined && { overview }),
        ...(products !== undefined && { products: products || null }),
        ...(challenges !== undefined && { challenges: challenges || null }),
        ...(keyFacts !== undefined && { keyFacts }),
        ...(sourceUrls !== undefined && { sourceUrls }),
        ...(isActive !== undefined && { isActive }),
        ...(owners !== undefined && { owners: owners || undefined }),
        ...(lastRefreshedAt !== undefined && {
          lastRefreshedAt: new Date(lastRefreshedAt),
        }),
        history: [...existingHistory, historyEntry],
      },
    });

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      profile as unknown as Record<string, unknown>,
      ["name", "industry", "website", "overview", "products", "challenges", "keyFacts", "sourceUrls", "isActive", "owners"]
    );

    // Audit log
    await logCustomerChange(
      lastRefreshedAt ? "REFRESHED" : "UPDATED",
      profile.id,
      profile.name,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return NextResponse.json(
      { error: "Failed to update customer profile" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Delete customer profile
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;

    // Check if profile is linked to any projects
    const linkedProjects = await prisma.projectCustomerProfile.count({
      where: { profileId: id },
    });

    if (linkedProjects > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete profile: it is linked to ${linkedProjects} project(s). Remove the associations first.`,
        },
        { status: 400 }
      );
    }

    // Get profile before deleting for audit log
    const profile = await prisma.customerProfile.findUnique({ where: { id } });

    await prisma.customerProfile.delete({
      where: { id },
    });

    // Audit log
    if (profile) {
      await logCustomerChange(
        "DELETED",
        id,
        profile.name,
        getUserFromSession(auth.session),
        undefined,
        { deletedProfile: { name: profile.name, industry: profile.industry } }
      );
    }

    return NextResponse.json(
      { message: "Customer profile deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting customer profile:", error);
    return NextResponse.json(
      { error: "Failed to delete customer profile" },
      { status: 500 }
    );
  }
}
