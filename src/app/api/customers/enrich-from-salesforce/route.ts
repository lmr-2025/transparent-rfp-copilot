import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import {
  isSalesforceConfigured,
  fetchAccountById,
  searchAccounts,
  mapAccountToProfile,
  SalesforceAccount,
} from "@/lib/salesforce";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/customers/enrich-from-salesforce?accountId=xxx or ?search=xxx
// Returns Salesforce data that can be used to enrich a customer profile
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  if (!isSalesforceConfigured()) {
    // Special 501 response for non-configured integrations - custom format for frontend handling
    return Response.json(
      {
        error: {
          code: "NOT_IMPLEMENTED",
          message: "Salesforce not configured",
        },
        configured: false,
        hint: "Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_REFRESH_TOKEN, and SALESFORCE_INSTANCE_URL",
      },
      { status: 501 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get("accountId");
  const searchTerm = searchParams.get("search");

  try {
    // Fetch by ID
    if (accountId) {
      const account = await fetchAccountById(accountId);

      if (!account) {
        return errors.notFound("Salesforce account");
      }

      const enrichmentData = mapAccountToProfile(account);

      return apiSuccess({
        account: formatAccountForResponse(account),
        enrichment: enrichmentData,
      });
    }

    // Search by name
    if (searchTerm) {
      if (searchTerm.length < 2) {
        return errors.badRequest("Search term must be at least 2 characters");
      }

      const accounts = await searchAccounts(searchTerm);

      return apiSuccess({
        results: accounts.map((a) => ({
          id: a.Id,
          name: a.Name,
          industry: a.Industry,
          website: a.Website,
          type: a.Type,
        })),
      });
    }

    return errors.badRequest("Provide accountId or search parameter");
  } catch (error) {
    logger.error("Salesforce API error", error, { route: "/api/customers/enrich-from-salesforce" });
    return errors.internal(error instanceof Error ? error.message : "Salesforce API error");
  }
}

function formatAccountForResponse(account: SalesforceAccount) {
  return {
    id: account.Id,
    name: account.Name,
    industry: account.Industry,
    website: account.Website,
    description: account.Description,
    billingLocation: [account.BillingCity, account.BillingState, account.BillingCountry]
      .filter(Boolean)
      .join(", ") || null,
    numberOfEmployees: account.NumberOfEmployees,
    annualRevenue: account.AnnualRevenue,
    type: account.Type,
    owner: account.Owner
      ? { name: account.Owner.Name, email: account.Owner.Email }
      : null,
    lastModified: account.LastModifiedDate,
  };
}
