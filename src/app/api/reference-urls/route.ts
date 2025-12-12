import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reference-urls - List all reference URLs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where = category ? { category } : {};

    const urls = await prisma.referenceUrl.findMany({
      where,
      orderBy: { addedAt: "desc" },
    });

    return NextResponse.json(urls);
  } catch (error) {
    console.error("Failed to fetch reference URLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch reference URLs" },
      { status: 500 }
    );
  }
}

// POST /api/reference-urls - Create a new reference URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const url = await prisma.referenceUrl.create({
      data: {
        url: body.url,
        title: body.title,
        description: body.description,
        category: body.category,
      },
    });

    return NextResponse.json(url, { status: 201 });
  } catch (error) {
    console.error("Failed to create reference URL:", error);
    return NextResponse.json(
      { error: "Failed to create reference URL" },
      { status: 500 }
    );
  }
}

// PUT /api/reference-urls - Bulk import URLs
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = body.urls as Array<{
      url: string;
      title?: string;
      description?: string;
      category?: string;
    }>;

    if (!Array.isArray(urls)) {
      return NextResponse.json(
        { error: "urls array required" },
        { status: 400 }
      );
    }

    // Upsert each URL (skip duplicates)
    const results = await Promise.all(
      urls.map((u) =>
        prisma.referenceUrl.upsert({
          where: { url: u.url },
          create: {
            url: u.url,
            title: u.title,
            description: u.description,
            category: u.category,
          },
          update: {
            title: u.title || undefined,
            description: u.description || undefined,
            category: u.category || undefined,
          },
        })
      )
    );

    return NextResponse.json({ imported: results.length, urls: results });
  } catch (error) {
    console.error("Failed to import reference URLs:", error);
    return NextResponse.json(
      { error: "Failed to import reference URLs" },
      { status: 500 }
    );
  }
}
