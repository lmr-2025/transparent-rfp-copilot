// Salesforce API Client
// Uses OAuth 2.0 with refresh token flow for server-side access

export type SalesforceConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  instanceUrl: string; // e.g., https://yourcompany.salesforce.com
};

export type SalesforceTokenResponse = {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
};

export type SalesforceAccount = {
  Id: string;
  Name: string;
  Industry?: string;
  Website?: string;
  Description?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Type?: string; // Customer, Prospect, Partner, etc.
  OwnerId?: string;
  Owner?: {
    Name?: string;
    Email?: string;
  };
  CreatedDate?: string;
  LastModifiedDate?: string;
  // Custom fields can be added here
  [key: string]: unknown;
};

export type SalesforceQueryResult<T> = {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
};

// Cache for access token (in-memory, resets on server restart)
let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig(): SalesforceConfig {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const refreshToken = process.env.SALESFORCE_REFRESH_TOKEN;
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;

  if (!clientId || !clientSecret || !refreshToken || !instanceUrl) {
    throw new Error(
      "Salesforce not configured. Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_REFRESH_TOKEN, and SALESFORCE_INSTANCE_URL environment variables."
    );
  }

  return { clientId, clientSecret, refreshToken, instanceUrl };
}

export function isSalesforceConfigured(): boolean {
  return !!(
    process.env.SALESFORCE_CLIENT_ID &&
    process.env.SALESFORCE_CLIENT_SECRET &&
    process.env.SALESFORCE_REFRESH_TOKEN &&
    process.env.SALESFORCE_INSTANCE_URL
  );
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const config = getConfig();

  const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Salesforce token: ${errorText}`);
  }

  const data = (await response.json()) as SalesforceTokenResponse;

  // Cache token for ~1 hour (Salesforce tokens typically last 2 hours)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return data.access_token;
}

export async function salesforceQuery<T>(soql: string): Promise<SalesforceQueryResult<T>> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${config.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${errorText}`);
  }

  return response.json() as Promise<SalesforceQueryResult<T>>;
}

export async function fetchAllAccounts(
  modifiedSince?: Date,
  accountTypes?: string[]
): Promise<SalesforceAccount[]> {
  let whereClause = "";
  const conditions: string[] = [];

  if (modifiedSince) {
    conditions.push(`LastModifiedDate >= ${modifiedSince.toISOString()}`);
  }

  if (accountTypes && accountTypes.length > 0) {
    const typeList = accountTypes.map((t) => `'${t}'`).join(", ");
    conditions.push(`Type IN (${typeList})`);
  }

  if (conditions.length > 0) {
    whereClause = ` WHERE ${conditions.join(" AND ")}`;
  }

  const soql = `
    SELECT
      Id, Name, Industry, Website, Description,
      BillingCity, BillingState, BillingCountry,
      NumberOfEmployees, AnnualRevenue, Type,
      OwnerId, Owner.Name, Owner.Email,
      CreatedDate, LastModifiedDate
    FROM Account
    ${whereClause}
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `.trim();

  const result = await salesforceQuery<SalesforceAccount>(soql);
  return result.records;
}

export async function fetchAccountById(accountId: string): Promise<SalesforceAccount | null> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${config.instanceUrl}/services/data/v59.0/sobjects/Account/${accountId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Salesforce account: ${errorText}`);
  }

  return response.json() as Promise<SalesforceAccount>;
}

// Search accounts by name (useful for linking)
export async function searchAccounts(searchTerm: string): Promise<SalesforceAccount[]> {
  // Escape special SOSL characters
  const escapedTerm = searchTerm.replace(/['"\\]/g, "\\$&");

  const config = getConfig();
  const accessToken = await getAccessToken();

  const sosl = `FIND {${escapedTerm}} IN NAME FIELDS RETURNING Account(Id, Name, Industry, Website, Type) LIMIT 20`;

  const response = await fetch(
    `${config.instanceUrl}/services/data/v59.0/search?q=${encodeURIComponent(sosl)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce search failed: ${errorText}`);
  }

  const data = (await response.json()) as { searchRecords: SalesforceAccount[] };
  return data.searchRecords || [];
}

// Map Salesforce Account to CustomerProfile fields
export function mapAccountToProfile(account: SalesforceAccount): {
  name: string;
  industry: string | null;
  website: string | null;
  overview: string;
  keyFacts: { label: string; value: string }[];
  tags: string[];
  salesforceId: string;
} {
  const keyFacts: { label: string; value: string }[] = [];

  if (account.NumberOfEmployees) {
    keyFacts.push({ label: "Employees", value: account.NumberOfEmployees.toLocaleString() });
  }
  if (account.AnnualRevenue) {
    keyFacts.push({
      label: "Annual Revenue",
      value: `$${(account.AnnualRevenue / 1000000).toFixed(1)}M`,
    });
  }
  if (account.BillingCity || account.BillingState || account.BillingCountry) {
    const location = [account.BillingCity, account.BillingState, account.BillingCountry]
      .filter(Boolean)
      .join(", ");
    keyFacts.push({ label: "Location", value: location });
  }
  if (account.Type) {
    keyFacts.push({ label: "Account Type", value: account.Type });
  }

  // Build overview from description or generate placeholder
  const overview =
    account.Description ||
    `${account.Name} is a ${account.Industry || "company"} based in ${
      account.BillingCountry || "unknown location"
    }.`;

  // Generate tags
  const tags: string[] = [];
  if (account.Industry) tags.push(account.Industry);
  if (account.Type) tags.push(account.Type);

  return {
    name: account.Name,
    industry: account.Industry || null,
    website: account.Website || null,
    overview,
    keyFacts,
    tags,
    salesforceId: account.Id,
  };
}
