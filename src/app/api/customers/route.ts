import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/customers - Get all customer profiles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const industry = searchParams.get("industry");
    const search = searchParams.get("search");

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
  try {
    const body = await request.json();
    const {
      name,
      industry,
      website,
      overview,
      products,
      challenges,
      keyFacts,
      tags,
      sourceUrls,
      isActive,
      createdBy,
      owners,
    } = body;

    if (!name || !overview) {
      return NextResponse.json(
        { error: "Missing required fields: name, overview" },
        { status: 400 }
      );
    }

    const profile = await prisma.customerProfile.create({
      data: {
        name,
        industry: industry || null,
        website: website || null,
        overview,
        products: products || null,
        challenges: challenges || null,
        keyFacts: keyFacts || [],
        tags: tags || [],
        sourceUrls: sourceUrls || [],
        isActive: isActive ?? true,
        createdBy: createdBy || null,
        owners: owners || null,
        history: [
          {
            date: new Date().toISOString(),
            action: "created",
            summary: "Profile created",
            user: createdBy || undefined,
          },
        ],
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Error creating customer profile:", error);
    return NextResponse.json(
      { error: "Failed to create customer profile" },
      { status: 500 }
    );
  }
}
