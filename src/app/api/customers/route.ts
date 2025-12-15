import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createCustomerSchema, validateBody } from "@/lib/validations";
import { logCustomerChange, getUserFromSession } from "@/lib/auditLog";

// GET /api/customers - Get all customer profiles
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const industry = searchParams.get("industry");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: {
      isActive?: boolean;
      industry?: string;
      OR?: Array<{ name?: { contains: string; mode: "insensitive" }; tags?: { has: string } }>;
    } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (industry) {
      where.industry = industry;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const profiles = await prisma.customerProfile.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ profiles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer profiles" },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create new customer profile
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createCustomerSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const profile = await prisma.customerProfile.create({
      data: {
        name: data.name,
        industry: data.industry || null,
        website: data.website || null,
        overview: data.overview,
        products: data.products || null,
        challenges: data.challenges || null,
        keyFacts: data.keyFacts,
        tags: data.tags,
        sourceUrls: data.sourceUrls,
        isActive: data.isActive,
        createdBy: auth.session.user.email || null,
        ownerId: auth.session.user.id,
        owners: data.owners || undefined,
        history: [
          {
            date: new Date().toISOString(),
            action: "created",
            summary: "Profile created",
            user: auth.session.user.email,
          },
        ],
      },
    });

    // Audit log
    await logCustomerChange(
      "CREATED",
      profile.id,
      profile.name,
      getUserFromSession(auth.session),
      undefined,
      { industry: data.industry, tags: data.tags }
    );

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Error creating customer profile:", error);
    return NextResponse.json(
      { error: "Failed to create customer profile" },
      { status: 500 }
    );
  }
}
