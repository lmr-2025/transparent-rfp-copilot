# Transparent RFP Copilot

A comprehensive, AI-powered RFP response platform with full transparency. Built for teams who need to answer security questionnaires, vendor assessments, and compliance requests at scale—while maintaining complete visibility into how answers are generated.

## Quick Start

```bash
# Clone and install
git clone https://github.com/lmr-2025/transparent-rfp-copilot.git
cd transparent-rfp-copilot
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

## Platform Architecture

The platform is built as a modern Next.js application with specialized modules:

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Projects** | Bulk questionnaire processing | Excel/CSV upload, multi-tab merge, per-question review |
| **Chat** | Conversational knowledge access | Skill selection, customer context, instruction presets |
| **Knowledge** | Centralized content library | Skills, documents, URLs, auto-categorization |
| **Contracts** | Document analysis | Key term extraction, risk identification, obligation tracking |
| **Admin** | Platform configuration | Prompts, categories, integrations, user management |

## Core Capabilities

### RFP Projects
- **Bulk Upload**: Import Excel workbooks or CSV files with automatic column detection
- **Multi-Tab Merge**: Combine questions from multiple worksheets into a single project
- **AI Responses**: Generate answers grounded in your knowledge base
- **Review Workflow**: Per-question approval with Slack notifications
- **Export**: Download completed questionnaires in original format

### Knowledge Management
- **Skills**: Structured knowledge chunks with quick facts, edge cases, and source tracking
- **Documents**: Upload PDFs, Word docs, or text files for AI reference
- **URLs**: Add web pages that are fetched and indexed for context
- **Auto-Categorization**: AI suggests categories during skill creation
- **Refresh**: Update skills from source URLs with diff preview

### Full Transparency
Every AI response includes:
- **Confidence Scores**: High/Medium/Low rating based on source coverage
- **Source Citations**: Which skills, documents, and URLs contributed
- **Reasoning**: How the answer was derived, what was inferred vs. found directly
- **Editable Prompts**: View and customize system prompts via the Prompt Builder

### Chat Interface
- **Skill Selection**: Choose which knowledge areas to include in responses
- **Customer Context**: Load customer profiles for tailored answers
- **Instruction Presets**: Save and reuse prompt configurations
- **Conversation History**: Full audit trail of all interactions

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 with App Router |
| **AI** | Claude API (Anthropic) - Sonnet, Opus, Haiku |
| **Database** | PostgreSQL 16 with Prisma ORM |
| **Auth** | NextAuth.js with Google/Okta OAuth, SSO group mappings |
| **UI** | React 19, Tailwind CSS, shadcn/ui, Radix primitives |
| **State** | React Query (server), Zustand (client) |
| **Rate Limiting** | Upstash Redis (optional, falls back to in-memory) |
| **Notifications** | Slack integration for review workflows |

## Module Details

### Projects (`/projects`)
Manage RFP questionnaires as reusable projects:
- Upload Excel/CSV with automatic sheet detection
- Map question columns across multiple tabs
- Generate AI responses with knowledge grounding
- Review and approve answers before export
- Track project status and completion

### Knowledge (`/knowledge`)
Build and maintain your response library:
- **Skills**: Create from URLs, documents, or manual entry
- **Bulk Import**: Add multiple URLs at once with AI grouping
- **Categories**: Organize skills (Security, Integrations, Pricing, etc.)
- **Owners**: Assign subject matter experts to skills
- **History**: Track all changes with full audit trail

### Chat (`/chat`)
Interactive knowledge exploration:
- Select specific skills to include in context
- Configure response style with instruction presets
- View transparency details for every response
- Export conversations for documentation

### Contracts (`/contracts`)
Analyze legal documents:
- Extract key terms and obligations
- Identify risks and compliance concerns
- Generate summaries and recommendations

### Admin (`/admin`)
Platform configuration:
- **Prompt Builder**: Customize system prompts with live preview
- **Categories**: Manage skill categories
- **Auth Groups**: Map SSO groups to capabilities
- **Settings**: Branding, integrations, rate limits
- **Question Log**: View all questions asked across the platform

## Permissions & Capabilities

The platform uses a capability-based permission system:

| Capability | Description |
|------------|-------------|
| `ASK_QUESTIONS` | Use chat, view own history |
| `CREATE_PROJECTS` | Create/manage bulk projects, upload documents |
| `REVIEW_ANSWERS` | Verify, correct, flag/resolve answers |
| `MANAGE_KNOWLEDGE` | Create/edit skills, documents, URLs |
| `MANAGE_PROMPTS` | Edit system prompts via Prompt Builder |
| `VIEW_ORG_DATA` | See org-wide question log, accuracy metrics |
| `MANAGE_USERS` | Assign capabilities, manage SSO group mappings |
| `ADMIN` | Full access to all features |

Capabilities are assigned via SSO group mappings (Okta, Azure AD, Google) or directly to users.

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
npm run test       # Run tests
npx prisma studio  # Open database GUI
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── chat/              # Chat interface
│   ├── contracts/         # Contract analysis
│   ├── knowledge/         # Knowledge base management
│   ├── projects/          # RFP project management
│   ├── admin/             # Admin settings & tools
│   └── accuracy/          # Accuracy tracking dashboard
├── components/            # Reusable React components
│   └── ui/               # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
│   ├── promptBlocks.ts   # Composable prompt system
│   ├── auth.ts           # Authentication config
│   ├── capabilities.ts   # Permission checks
│   └── prisma.ts         # Database client
├── stores/               # Zustand state stores
└── types/                # TypeScript definitions
```

## AWS Deployment

Complete production-ready infrastructure for deploying to AWS with Terraform modules for all components.

### Infrastructure Modules

All infrastructure is defined as reusable Terraform modules in `/infrastructure`:

| Module | Description | Status |
|--------|-------------|--------|
| **IAM** | Roles and policies for all services | ✅ Complete |
| **VPC** | Multi-AZ networking with public/private subnets | ✅ Complete |
| **Security Groups** | Fine-grained network access control | ✅ Complete |
| **ALB** | Application Load Balancer with SSL | ✅ Complete |
| **ECS/Fargate** | Serverless container orchestration | ✅ Complete |
| **Amplify** | Alternative: Fully managed hosting | ✅ Complete |
| **RDS** | PostgreSQL with Multi-AZ, encryption, automated backups | ✅ Complete |
| **Redis** | ElastiCache or Upstash for rate limiting | ✅ Complete |
| **S3** | Encrypted storage with lifecycle policies | ✅ Complete |
| **Secrets Manager** | Secure credential storage with rotation | ✅ Complete |
| **Monitoring** | CloudWatch dashboards, alarms, SNS alerts | ✅ Complete |
| **DNS/CDN** | Route 53 + ACM + optional CloudFront | ✅ Complete |
| **CI/CD** | GitHub Actions or CodePipeline | ✅ Complete |
| **Compliance** | CloudTrail, Config, GuardDuty, Security Hub | ✅ Complete |
| **Cost Management** | Budgets, anomaly detection, optimization | ✅ Complete |

### Quick Deploy

```bash
# 1. Configure AWS credentials
aws configure

# 2. Initialize Terraform
cd infrastructure
terraform init

# 3. Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_name = "transparent-trust"
environment  = "production"
domain_name  = "yourdomain.com"

# Database
db_username = "admin"
db_name     = "rfp_copilot"

# Alerts
alert_emails = ["ops@example.com"]

# Budget
monthly_budget = "200"  # USD
EOF

# 4. Deploy infrastructure
terraform plan
terraform apply

# 5. Deploy application (GitHub Actions or CodePipeline)
git push origin main
```

### Architecture Options

**Option 1: AWS Amplify (Recommended)**
- Fully managed hosting with Git-based CI/CD
- Automatic builds and deployments
- PR preview environments
- Cost: ~$5-30/month

**Option 2: ECS Fargate**
- More control and flexibility
- Better for complex requirements
- Auto-scaling and self-healing
- Cost: ~$30-50/month

### Estimated Monthly Costs

| Configuration | Monthly Cost | Description |
|--------------|--------------|-------------|
| **Minimal** | $29-39 | Amplify + Single-AZ RDS + Basic monitoring |
| **Standard** | $130-163 | ECS + Multi-AZ RDS + Full compliance |
| **Optimized** | $75-100 | Cost-optimized with Upstash, VPC endpoints |

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for detailed deployment guide.

### Security & Compliance

All infrastructure modules include:
- ✅ Encryption at rest and in transit
- ✅ Multi-AZ high availability
- ✅ Automated backups and disaster recovery
- ✅ Least privilege IAM policies
- ✅ Network isolation (VPC, private subnets)
- ✅ Comprehensive monitoring and alerting
- ✅ Audit logging (CloudTrail)
- ✅ Compliance monitoring (AWS Config)
- ✅ Threat detection (GuardDuty)
- ✅ Cost tracking and optimization

**Compliance Frameworks**: SOC 2 Type II, HIPAA, PCI DSS

### Infrastructure Documentation

- **[AWS Deployment Guide](docs/AWS_DEPLOYMENT.md)**: Complete deployment walkthrough
- **[RDS Security](docs/RDS_SECURITY.md)**: Database security best practices
- **[Monitoring Runbook](docs/runbooks/rds-security-monitoring.md)**: Operational procedures

Each infrastructure module includes:
- `README.md` - Usage examples and troubleshooting
- `variables.tf` - Configurable parameters
- `outputs.tf` - Values for other modules
- `main.tf` - Resource definitions

## Documentation

- **Prompt System**: See `/admin/prompt-blocks` for the composable prompt builder
- **API**: All routes documented in `/src/app/api/` with JSDoc comments
- **Database Schema**: See `prisma/schema.prisma` for data models
- **AWS Infrastructure**: See `/infrastructure` and `docs/AWS_DEPLOYMENT.md`

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.

---

Built with transparency in mind. Every answer is traceable, every source is cited, every decision is visible.
