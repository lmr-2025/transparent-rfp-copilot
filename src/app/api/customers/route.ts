/**
 * Customers API Route - Customer Profile Management
 *
 * CRUD operations for customer profiles. Customer profiles store
 * information about clients/prospects that can be referenced
 * when answering RFP questions.
 *
 * @module /api/customers
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createCustomerSchema, validateBody } from "@/lib/validations";
import { logCustomerChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * GET /api/customers - List customer profiles
 *
 * @description Retrieves customer profiles with optional filtering.
 * Results are ordered by most recently updated first.
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @query {string} [active="false"] - Filter by active status ("true" for active only)
 * @query {string} [industry] - Filter by industry name
 * @query {string} [search] - Search by customer name (case-insensitive)
 * @query {number} [limit=100] - Maximum profiles to return (max 500)
 * @query {number} [offset=0] - Number of profiles to skip (for pagination)
 *
 * @returns {{ profiles: CustomerProfile[] }} 200 - List of customer profiles
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * GET /api/customers?active=true&industry=Healthcare&limit=20
 */
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
      name?: { contains: string; mode: "insensitive" };
    } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (industry) {
      where.industry = industry;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const profiles = await prisma.customerProfile.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return apiSuccess({ profiles });
  } catch (error) {
    logger.error("Failed to fetch customer profiles", error, { route: "/api/customers" });
    return errors.internal("Failed to fetch customer profiles");
  }
}

/**
 * POST /api/customers - Create a new customer profile
 *
 * @description Creates a new customer profile in the database.
 * Customer profiles store key information about clients/prospects.
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @body {string} name - Customer/company name (required)
 * @body {string} overview - Summary of the customer (required)
 * @body {string} [industry] - Industry sector
 * @body {string} [website] - Company website URL
 * @body {string} [products] - Description of products/services they offer
 * @body {string} [challenges] - Known challenges or pain points
 * @body {KeyFact[]} [keyFacts] - Array of {label, value} pairs
 * @body {SourceUrl[]} [sourceUrls] - Source URLs for the profile data
 *
 * @returns {{ profile: CustomerProfile }} 201 - Created profile
 * @returns {{ error: string }} 400 - Validation error
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * POST /api/customers
 * { "name": "Acme Corp", "overview": "Enterprise software company..." }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createCustomerSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
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
        sourceUrls: data.sourceUrls,
        // New fields
        content: data.content || null,
        considerations: data.considerations || [],
        sourceDocuments: data.sourceDocuments || [],
        // Salesforce static fields
        salesforceId: data.salesforceId || null,
        region: data.region || null,
        tier: data.tier || null,
        employeeCount: data.employeeCount || null,
        annualRevenue: data.annualRevenue || null,
        accountType: data.accountType || null,
        billingLocation: data.billingLocation || null,
        lastSalesforceSync: data.lastSalesforceSync || null,
        // Metadata
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
      { industry: data.industry }
    );

    return apiSuccess({ profile }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create customer profile", error, { route: "/api/customers" });
    return errors.internal("Failed to create customer profile");
  }
}
