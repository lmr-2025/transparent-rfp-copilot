# Transparent Trust

AI-powered RFP response platform with full transparency. Answer security questionnaires, vendor assessments, and compliance requests at scale with complete visibility into how answers are generated.

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and API keys

# Initialize database
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the platform.

### AWS Deployment

The application deploys to AWS using Terraform. See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for complete deployment guide including:
- Infrastructure setup (Terraform, ECS/Amplify options)
- Security configuration and compliance
- Cost estimates and optimization
- Monitoring and operational procedures

## Features

### RFP Projects
Bulk questionnaire processing with Excel/CSV upload, multi-tab merge, AI-generated answers grounded in your knowledge base, per-question review workflow with Slack notifications, and export to original format.

### Knowledge Management
Build your response library with Skills (structured knowledge chunks), Documents (PDFs, Word, text), and URLs (auto-fetched web pages). AI auto-categorization, source tracking, and refresh capabilities with diff preview.

### Full Transparency
Every AI response includes confidence scores (High/Medium/Low), source citations (which skills/documents contributed), reasoning (how the answer was derived), and editable prompts via the Prompt Builder.

### Chat Interface
Conversational knowledge access with skill selection, customer context loading, instruction presets, and full conversation history audit trail.

### Contract Analysis
Extract key terms and obligations, identify risks and compliance concerns, generate summaries and recommendations.

## Tech Stack

Next.js 15, React 19, Claude API (Anthropic), PostgreSQL 16 with Prisma, NextAuth.js with Google/Okta OAuth, Tailwind CSS with shadcn/ui, React Query, Zustand, Upstash Redis (optional), Slack integration.

## Permissions

Capability-based system with `ASK_QUESTIONS`, `CREATE_PROJECTS`, `REVIEW_ANSWERS`, `MANAGE_KNOWLEDGE`, `MANAGE_PROMPTS`, `VIEW_ORG_DATA`, `MANAGE_USERS`, and `ADMIN`. Capabilities assigned via SSO group mappings (Okta, Azure AD, Google) or directly to users.

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rfp_copilot"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Rate Limiting (optional)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Slack Integration (optional)
SLACK_WEBHOOK_URL="your-slack-webhook-url"
```

## Development

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # Run ESLint
npx prisma studio  # Open database GUI
```

## Project Structure

```
src/app/              # Next.js App Router (api, chat, contracts, knowledge, projects, admin)
src/components/       # React components + shadcn/ui
src/lib/              # Utilities (promptBlocks, auth, capabilities, prisma)
infrastructure/       # Terraform modules for AWS deployment
```

For AWS deployment architecture, security, and cost details, see [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md).

## Third-Party Integrations

The platform supports optional integrations with external systems:

| Integration | Purpose | Documentation |
|-------------|---------|---------------|
| **Salesforce** | Customer data enrichment | [Setup Guide](docs/INTEGRATIONS.md#salesforce-integration) |
| **Google OAuth** | SSO + Slides template filling | [Setup Guide](docs/INTEGRATIONS.md#google-oauth--slides) |
| **Snowflake** | GTM data queries | [Setup Guide](docs/INTEGRATIONS.md#snowflake-integration) |
| **Okta** | Enterprise SSO with group sync | [Setup Guide](docs/INTEGRATIONS.md#okta-sso) |
| **Slack** | Review notifications | [Setup Guide](docs/INTEGRATIONS.md#slack-notifications) |

All integrations are **optional**. The platform works fully without any external integrations. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for complete setup instructions.

## Documentation

- **Third-Party Integrations**: See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for Salesforce, Google, Snowflake, Okta, and Slack setup
- **AWS Deployment**: See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for production infrastructure
- **Prompt System**: See `/admin/prompt-blocks` for the composable prompt builder
- **API**: All routes documented in `/src/app/api/` with JSDoc comments
- **Database Schema**: See `prisma/schema.prisma` for data models

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.
