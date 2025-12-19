# Third-Party Integrations

Complete guide for integrating Transparent Trust with external systems including Salesforce, Google Workspace, Snowflake, Okta, and Slack.

## Table of Contents

1. [Salesforce Integration](#salesforce-integration)
2. [Google OAuth & Slides](#google-oauth--slides)
3. [Snowflake Integration](#snowflake-integration)
4. [Okta SSO](#okta-sso)
5. [Slack Notifications](#slack-notifications)
6. [Troubleshooting](#troubleshooting)

---

## Salesforce Integration

Sync customer data from Salesforce to enrich customer profiles with account information, industry, revenue, and contact details.

### Features

- **Customer Enrichment**: Auto-populate customer profiles from Salesforce Account records
- **Account Search**: Search and link Salesforce accounts by name
- **Static Field Sync**: Automatically sync read-only fields (name, industry, revenue, etc.)
- **Bi-directional Updates**: Changes in Salesforce automatically flow to customer profiles
- **Real-time Queries**: Live SOQL queries with OAuth 2.0 authentication

### Setup Steps

#### 1. Create Connected App in Salesforce

1. Log in to Salesforce as an administrator
2. Navigate to **Setup** → **Apps** → **App Manager**
3. Click **New Connected App**
4. Fill in the required fields:
   - **Connected App Name**: `Transparent Trust`
   - **API Name**: `Transparent_Trust`
   - **Contact Email**: Your email
5. Under **API (Enable OAuth Settings)**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `https://login.salesforce.com/services/oauth2/success`
   - **Selected OAuth Scopes**:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - Check **Enable Client Credentials Flow** (optional, for server-to-server)
6. Click **Save**
7. Note the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)

#### 2. Generate Refresh Token

The refresh token allows the app to access Salesforce without user intervention. Generate it once:

```bash
# 1. Get authorization code (replace CLIENT_ID and REDIRECT_URI)
# Open this URL in browser:
https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://login.salesforce.com/services/oauth2/success&scope=api%20refresh_token

# 2. After approving, copy the "code" parameter from the URL

# 3. Exchange code for refresh token (replace values)
curl -X POST https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "redirect_uri=https://login.salesforce.com/services/oauth2/success"

# 4. Save the "refresh_token" from the response
```

#### 3. Configure Environment Variables

Add these to your `.env` file:

```bash
# Salesforce OAuth 2.0 Configuration
SALESFORCE_CLIENT_ID=your_consumer_key_from_step_1
SALESFORCE_CLIENT_SECRET=your_consumer_secret_from_step_1
SALESFORCE_REFRESH_TOKEN=your_refresh_token_from_step_2
SALESFORCE_INSTANCE_URL=https://yourcompany.salesforce.com
```

**Note**: For sandbox environments, use `https://test.salesforce.com` for the token endpoint in step 2.

#### 4. Verify Connection

Test the integration:

```bash
# Start development server
npm run dev

# Navigate to Customers page → Add Customer → "Link Salesforce Account"
# You should see a search interface for Salesforce accounts
```

### API Endpoints

**Search Accounts**:
```
GET /api/customers/enrich-from-salesforce?search=Acme
Response: { results: [{ id, name, industry, website, type }] }
```

**Fetch Account Details**:
```
GET /api/customers/enrich-from-salesforce?accountId=001xx000003DHbpAAG
Response: { account: {...}, enrichment: {...} }
```

### Customization

The integration supports custom Salesforce fields. Edit [src/lib/salesforce.ts](../src/lib/salesforce.ts):

```typescript
// Add custom fields to SalesforceAccount type
export type SalesforceAccount = {
  // ... standard fields
  Custom_Field__c?: string; // Your custom field
};

// Include in SOQL query
const soql = `
  SELECT
    Id, Name, Industry, Website,
    Custom_Field__c  // Add here
  FROM Account
`;
```

### Troubleshooting

**Error: "Failed to refresh Salesforce token"**
- Verify `SALESFORCE_REFRESH_TOKEN` is correct and hasn't expired
- Refresh tokens can expire if not used for 3 months (configurable in Connected App settings)
- Re-generate the refresh token following step 2 above

**Error: "Salesforce not configured"**
- All four environment variables must be set: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_REFRESH_TOKEN`, `SALESFORCE_INSTANCE_URL`
- Check for typos or extra whitespace

**Empty search results**
- Verify the Salesforce user has access to Account records
- Check that Account records exist matching the search term
- Review Connected App permissions in Salesforce

---

## Google OAuth & Slides

Authenticate users with Google Workspace and enable Google Slides template filling for customer deliverables.

### Features

- **Single Sign-On**: Users can sign in with their Google Workspace account
- **Domain Restrictions**: Limit access to specific domains (e.g., yourcompany.com)
- **Slides Integration**: Auto-fill presentation templates with customer data
- **Refresh Tokens**: Persistent API access for background operations
- **Group Mappings**: Map Google groups to capabilities (requires Google Workspace admin)

### Setup Steps

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Enter project name: `Transparent Trust` → **Create**
4. Wait for project creation, then select it

#### 2. Enable APIs

1. Navigate to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google+ API** (for user profile)
   - **Google Slides API** (for template filling)
   - **Google Drive API** (for file access)

#### 3. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (for Google Workspace) or **External** (for public access)
3. Fill in required fields:
   - **App name**: `Transparent Trust`
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **Save and Continue**
5. On **Scopes** page, click **Add or Remove Scopes**:
   - `/auth/userinfo.email`
   - `/auth/userinfo.profile`
   - `openid`
   - `/auth/presentations` (Google Slides read/write)
   - `/auth/drive.readonly` (list presentations)
   - `/auth/drive.file` (create/edit files)
6. Click **Save and Continue**
7. Review and click **Back to Dashboard**

#### 4. Create OAuth Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: `Web application`
4. **Name**: `Transparent Trust Web`
5. **Authorized JavaScript origins**:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
6. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Click **Create**
8. Note the **Client ID** and **Client Secret**

#### 5. Configure Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_from_step_4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_4

# Optional: Restrict to specific domain(s) - comma-separated
GOOGLE_ALLOWED_DOMAINS=yourcompany.com,partner.com

# NextAuth Configuration (required for OAuth)
NEXTAUTH_URL=http://localhost:3000  # Change to production URL in prod
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

#### 6. Verify Sign-In

1. Restart development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click **Sign in with Google**
4. Authorize the app with your Google account
5. You should be redirected back to the app, signed in

### Slides Template Filling

The integration includes automatic template filling for customer presentations:

**Create Template**:
1. Create a Google Slides presentation
2. Use placeholders: `{{customer.name}}`, `{{customer.industry}}`, etc.
3. Share the presentation with "Anyone with the link can view"
4. Copy the presentation ID from the URL

**Fill Template** (API):
```typescript
// POST /api/google/slides/fill-template
{
  templateId: "1abc...",
  customerId: "customer-uuid",
  outputName: "Acme Corp - Security Overview"
}
```

### Domain Restrictions

To restrict sign-in to specific Google Workspace domain(s):

```bash
# .env
GOOGLE_ALLOWED_DOMAINS=yourcompany.com
```

Users with emails outside this domain will see an error during sign-in.

### Group-Based Capabilities

To map Google Workspace groups to capabilities:

1. **Enable Admin SDK API** in Google Cloud Console
2. **Grant domain-wide delegation**:
   - Go to Google Workspace Admin → Security → API Controls → Domain-wide Delegation
   - Add client ID with scope: `https://www.googleapis.com/auth/admin.directory.group.readonly`
3. **Configure in app**:
   - Navigate to `/admin/auth-groups`
   - Add mappings: `engineering@company.com` → `MANAGE_KNOWLEDGE`

### Troubleshooting

**Error: "redirect_uri_mismatch"**
- The redirect URI in the OAuth consent request doesn't match the authorized URIs in Google Cloud Console
- Ensure `NEXTAUTH_URL` matches the authorized JavaScript origin exactly (including http/https)
- Check for trailing slashes

**Error: "access_denied"**
- User denied authorization
- Or, user's email domain doesn't match `GOOGLE_ALLOWED_DOMAINS`

**Slides API returns 403**
- Verify Google Slides API is enabled in Google Cloud Console
- Check that the OAuth token includes the `presentations` scope
- User may need to re-authenticate to grant the new scope

---

## Snowflake Integration

Query GTM (Go-to-Market) data from Snowflake to enrich customer profiles with usage metrics, product adoption, and engagement scores.

### Features

- **GTM Data Sync**: Import usage metrics, feature adoption, NPS scores
- **Custom Queries**: Execute arbitrary SQL queries against your Snowflake warehouse
- **Secure Credentials**: Credentials stored in environment variables, never in database
- **Connection Pooling**: Efficient connection management for multiple queries

### Setup Steps

#### 1. Create Snowflake Service Account

1. Log in to Snowflake as `ACCOUNTADMIN`
2. Create a dedicated user for the integration:

```sql
-- Create user
CREATE USER transparent_trust_app
  PASSWORD = 'generate_strong_password_here'
  DEFAULT_ROLE = TRANSPARENT_TRUST_READONLY
  DEFAULT_WAREHOUSE = COMPUTE_WH
  COMMENT = 'Service account for Transparent Trust integration';

-- Create role with read-only access
CREATE ROLE TRANSPARENT_TRUST_READONLY
  COMMENT = 'Read-only access to GTM data for Transparent Trust';

-- Grant role to user
GRANT ROLE TRANSPARENT_TRUST_READONLY TO USER transparent_trust_app;

-- Grant warehouse usage
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE TRANSPARENT_TRUST_READONLY;

-- Grant database and schema access
GRANT USAGE ON DATABASE YOUR_GTM_DATABASE TO ROLE TRANSPARENT_TRUST_READONLY;
GRANT USAGE ON SCHEMA YOUR_GTM_DATABASE.PUBLIC TO ROLE TRANSPARENT_TRUST_READONLY;

-- Grant SELECT on relevant tables
GRANT SELECT ON ALL TABLES IN SCHEMA YOUR_GTM_DATABASE.PUBLIC TO ROLE TRANSPARENT_TRUST_READONLY;

-- Grant SELECT on future tables (optional)
GRANT SELECT ON FUTURE TABLES IN SCHEMA YOUR_GTM_DATABASE.PUBLIC TO ROLE TRANSPARENT_TRUST_READONLY;
```

#### 2. Test Connection

Test the credentials from your local machine:

```bash
# Install Snowflake CLI (optional)
brew install snowflake-cli  # macOS
# or download from https://docs.snowflake.com/en/user-guide/snowsql-install-config

# Test connection
snowsql -a YOUR_ACCOUNT.REGION -u transparent_trust_app -d YOUR_GTM_DATABASE -s PUBLIC -w COMPUTE_WH
# Enter password when prompted

# Run test query
SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE();
```

#### 3. Configure Environment Variables

Add these to your `.env` file:

```bash
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_account.us-east-1  # Format: account.region
SNOWFLAKE_USER=transparent_trust_app
SNOWFLAKE_PASSWORD=your_service_account_password
SNOWFLAKE_WAREHOUSE=COMPUTE_WH  # Or your preferred warehouse
SNOWFLAKE_DATABASE=YOUR_GTM_DATABASE
SNOWFLAKE_SCHEMA=PUBLIC
```

**Note**: The account identifier format varies by region. Find yours in Snowflake Admin → Account → Account Locator.

#### 4. Verify Integration

Test the connection:

```bash
# Start development server
npm run dev

# Test API endpoint
curl http://localhost:3000/api/snowflake/customer-data?email=customer@example.com
```

### API Endpoints

**Fetch Customer GTM Data**:
```
GET /api/snowflake/customer-data?email=customer@example.com
Response: { usage, features, nps, ... }
```

**Execute Custom Query**:
```
POST /api/snowflake/query
Body: { sql: "SELECT * FROM accounts WHERE domain = ?", params: ["example.com"] }
Response: { rows: [...], rowCount: N }
```

### Customization

The integration queries are defined in [src/app/api/snowflake/customer-data/route.ts](../src/app/api/snowflake/customer-data/route.ts). Customize the SQL:

```typescript
// Example: Add product adoption query
const adoptionQuery = `
  SELECT
    product_name,
    first_used_at,
    last_used_at,
    usage_count
  FROM product_usage
  WHERE user_email = ?
  ORDER BY usage_count DESC
`;
```

### Security Best Practices

- **Least Privilege**: Grant only `SELECT` permissions, never `INSERT`/`UPDATE`/`DELETE`
- **Read-Only Role**: Use a dedicated read-only role
- **Credential Rotation**: Rotate service account password every 90 days
- **Query Validation**: Always use parameterized queries to prevent SQL injection
- **Warehouse Limits**: Set max query time and concurrency limits on the warehouse

### Troubleshooting

**Error: "Authentication failed"**
- Verify `SNOWFLAKE_USER` and `SNOWFLAKE_PASSWORD` are correct
- Check that the user is not locked (try logging in via Snowflake web UI)

**Error: "Object does not exist"**
- Verify `SNOWFLAKE_DATABASE` and `SNOWFLAKE_SCHEMA` are correct
- Check that the role has `USAGE` grants on database and schema
- Confirm table names are correct (case-sensitive)

**Error: "Insufficient privileges"**
- The role lacks `SELECT` permission on the queried table
- Re-run the `GRANT SELECT` statements from step 1

**Slow queries**
- Use a larger warehouse (e.g., `LARGE` instead of `X-SMALL`)
- Add indexes to frequently queried columns (Snowflake uses automatic clustering)
- Check query execution plan: `EXPLAIN <your_query>`

---

## Okta SSO

Enterprise single sign-on with Okta for centralized user management and group-based permissions.

### Features

- **SAML 2.0 / OIDC**: Standards-based authentication
- **Group Sync**: Map Okta groups to capabilities
- **Just-in-Time Provisioning**: Auto-create users on first login
- **Session Management**: Configurable session timeout and refresh
- **Multi-Factor Authentication**: Inherits Okta MFA policies

### Setup Steps

#### 1. Create Okta Application

1. Log in to [Okta Admin Console](https://yourdomain.okta.com/admin)
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Select **OIDC - OpenID Connect** → **Web Application** → **Next**
5. Fill in details:
   - **App integration name**: `Transparent Trust`
   - **Logo**: Upload your logo (optional)
   - **Sign-in redirect URIs**:
     - `http://localhost:3000/api/auth/callback/okta` (development)
     - `https://yourdomain.com/api/auth/callback/okta` (production)
   - **Sign-out redirect URIs**:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - **Controlled access**: Choose who can access (e.g., "Allow everyone in your organization")
6. Click **Save**
7. Note the **Client ID**, **Client Secret**, and **Okta domain**

#### 2. Configure Group Claims

To include Okta groups in the ID token:

1. In the Okta application, go to **Sign On** tab
2. Click **Edit** next to **OpenID Connect ID Token**
3. Add **Groups claim**:
   - **Groups claim type**: `Filter`
   - **Groups claim filter**: `groups` `Matches regex` `.*`
   - This includes all groups; customize the regex to filter specific groups
4. Click **Save**

#### 3. Assign Users and Groups

1. In the Okta application, go to **Assignments** tab
2. Click **Assign** → **Assign to Groups**
3. Assign the groups that should have access to Transparent Trust
4. Click **Done**

#### 4. Configure Environment Variables

Add these to your `.env` file:

```bash
# Okta OIDC Configuration
OKTA_CLIENT_ID=your_client_id_from_step_1
OKTA_CLIENT_SECRET=your_client_secret_from_step_1
OKTA_ISSUER=https://yourdomain.okta.com/oauth2/default  # Or custom authorization server

# NextAuth Configuration (required)
NEXTAUTH_URL=http://localhost:3000  # Change to production URL in prod
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
```

#### 5. Map Groups to Capabilities

1. Restart the app: `npm run dev`
2. Sign in with an Okta admin account
3. Navigate to `/admin/auth-groups`
4. Add group mappings:
   - Okta group: `Engineering` → Capabilities: `MANAGE_KNOWLEDGE`, `CREATE_PROJECTS`
   - Okta group: `Sales` → Capabilities: `ASK_QUESTIONS`, `VIEW_ORG_DATA`
   - Okta group: `Admins` → Capabilities: `ADMIN` (full access)

#### 6. Verify Sign-In

1. Log out and click **Sign in with Okta**
2. Enter Okta credentials
3. Verify that you're redirected back to the app
4. Check that your capabilities match the group mappings

### Custom Authorization Server

For advanced control, use a custom Okta authorization server:

1. In Okta Admin Console, go to **Security** → **API**
2. Click **Add Authorization Server**
3. Configure claims and scopes as needed
4. Update `OKTA_ISSUER` to your custom server URL

### Troubleshooting

**Error: "Unable to retrieve user info"**
- Verify `OKTA_ISSUER` ends with `/oauth2/default` or your custom server path
- Check that the application has `openid`, `profile`, `email` scopes

**Error: "redirect_uri_mismatch"**
- The redirect URI doesn't match the configured URIs in Okta
- Ensure `NEXTAUTH_URL` matches exactly (including http/https)

**Groups not syncing**
- Verify the Groups claim filter is configured (step 2)
- Check that the user is assigned to at least one group
- Try re-authenticating to refresh the token

---

## Slack Notifications

Send notifications to Slack channels for review workflows, answer approvals, and system alerts.

### Features

- **Review Notifications**: Alert reviewers when answers are ready
- **Approval Confirmations**: Notify submitters when answers are approved
- **Error Alerts**: Send system errors to a monitoring channel
- **Custom Formatting**: Rich message formatting with links and emojis

### Setup Steps

#### 1. Create Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. **App Name**: `Transparent Trust`
4. **Workspace**: Select your workspace → **Create App**

#### 2. Enable Incoming Webhooks

1. In the app settings, navigate to **Features** → **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Scroll down and click **Add New Webhook to Workspace**
4. Select the channel to post to (e.g., `#rfp-reviews`) → **Allow**
5. Copy the **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

#### 3. Configure Environment Variable

Add to your `.env` file:

```bash
# Slack Webhook for Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

#### 4. Test Notification

```bash
# Start development server
npm run dev

# Trigger a review (e.g., submit answers for review in a project)
# You should see a notification in your Slack channel
```

### Customization

Edit notification messages in [src/lib/slack.ts](../src/lib/slack.ts):

```typescript
export async function sendReviewNotification(project: string, count: number) {
  await sendSlackMessage({
    text: `🔔 ${count} answers ready for review in project "${project}"`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${count}* answers are ready for review in *${project}*`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review Now" },
            url: `${process.env.NEXTAUTH_URL}/reviews`,
          },
        ],
      },
    ],
  });
}
```

### Multiple Channels

To send different notifications to different channels, create multiple webhooks:

```bash
# .env
SLACK_WEBHOOK_REVIEWS=https://hooks.slack.com/services/.../...  # For review notifications
SLACK_WEBHOOK_ERRORS=https://hooks.slack.com/services/.../...    # For error alerts
```

### Troubleshooting

**Error: "invalid_token" or "channel_not_found"**
- The webhook URL is incorrect or has been revoked
- Regenerate the webhook in Slack app settings

**Notifications not appearing**
- Verify `SLACK_WEBHOOK_URL` is set and doesn't have extra whitespace
- Check that the channel still exists
- Test the webhook with curl:
  ```bash
  curl -X POST YOUR_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d '{"text":"Test notification"}'
  ```

---

## Troubleshooting

### General Issues

**"Integration not configured" errors**
- Check that all required environment variables are set
- Restart the development server after adding environment variables
- Verify no typos or extra spaces in variable names

**OAuth errors during sign-in**
- Ensure `NEXTAUTH_URL` matches your actual URL (including http/https)
- Check that `NEXTAUTH_SECRET` is set and is at least 32 characters
- Clear browser cookies and try again

**API rate limiting**
- Most integrations cache tokens and responses to minimize API calls
- For Salesforce: tokens cached 1 hour, queries not cached
- For Google: tokens refreshed automatically by NextAuth
- For Snowflake: consider implementing query result caching

### Security Checklist

Before deploying to production:

- [ ] All integration credentials are stored in environment variables, not code
- [ ] Service accounts use read-only permissions where possible
- [ ] OAuth redirect URIs are restricted to your production domain
- [ ] Google domain restrictions are enabled (`GOOGLE_ALLOWED_DOMAINS`)
- [ ] Secrets are stored in AWS Secrets Manager (see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md))
- [ ] API endpoints validate user capabilities before returning data
- [ ] No credentials are logged in application logs

### Getting Help

- **Salesforce**: [OAuth 2.0 Documentation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_flows.htm)
- **Google OAuth**: [Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- **Snowflake**: [Connecting to Snowflake](https://docs.snowflake.com/en/user-guide/nodejs-driver-use)
- **Okta**: [OIDC & OAuth 2.0 API](https://developer.okta.com/docs/reference/api/oidc/)
- **Slack**: [Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

## Summary

| Integration | Purpose | Required Env Vars | Capabilities |
|-------------|---------|-------------------|--------------|
| **Salesforce** | Customer data enrichment | 4 variables | Account search, data sync, custom fields |
| **Google OAuth** | SSO + Slides integration | 2-3 variables | Authentication, domain restrictions, template filling |
| **Snowflake** | GTM data queries | 6 variables | Usage metrics, custom SQL, secure read-only access |
| **Okta** | Enterprise SSO | 3 variables | Group sync, JIT provisioning, MFA |
| **Slack** | Notifications | 1 variable | Review alerts, approval confirmations, error monitoring |

All integrations are **optional** and the platform works without them. Enable only the integrations you need.
