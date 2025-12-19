# AWS Deployment Guide

This document outlines the complete AWS infrastructure setup for deploying the Transparent RFP Copilot application to production.

## Overview

The Transparent RFP Copilot is a Next.js 16 application that requires:
- Container orchestration (ECS/Fargate or Amplify)
- PostgreSQL database (RDS)
- File storage (S3)
- Authentication (SSO + NextAuth with Google OAuth)
- Secrets management
- Monitoring and logging
- CI/CD pipeline

## Linear Project Tracking

**Parent Issue**: [SEC-1044 - Transparent Trust - AWS Deployment Infrastructure](https://linear.app/montecarlodata/issue/SEC-1044/transparent-trust-aws-deployment-infrastructure)

All subtasks are tracked in Linear under the Security team.

## Quick Links to Linear Issues

| Phase | Linear Issue | Status |
|-------|--------------|--------|
| **0. AWS Account** | [SEC-1063](https://linear.app/montecarlodata/issue/SEC-1063) | 🔴 Not Started |
| **1.1 AWS SSO** | [SEC-1045](https://linear.app/montecarlodata/issue/SEC-1045) | 🔴 Not Started |
| **1.2 IAM Roles** | [SEC-1046](https://linear.app/montecarlodata/issue/SEC-1046) | ✅ Complete |
| **2.1 VPC** | [SEC-1051](https://linear.app/montecarlodata/issue/SEC-1051) | 🔴 Not Started |
| **2.2 Security Groups** | [SEC-1053](https://linear.app/montecarlodata/issue/SEC-1053) | 🔴 Not Started |
| **2.3 Load Balancer** | [SEC-1052](https://linear.app/montecarlodata/issue/SEC-1052) | 🔴 Not Started |
| **3.1 RDS PostgreSQL** | [SEC-1049](https://linear.app/montecarlodata/issue/SEC-1049) | 🔴 Not Started |
| **3.2 RDS Security** | [SEC-1050](https://linear.app/montecarlodata/issue/SEC-1050) | 🔴 Not Started |
| **4.1 S3 Buckets** | [SEC-1054](https://linear.app/montecarlodata/issue/SEC-1054) | 🔴 Not Started |
| **4.2 S3 Policies** | [SEC-1055](https://linear.app/montecarlodata/issue/SEC-1055) | 🔴 Not Started |
| **5. Secrets Manager** | [SEC-1056](https://linear.app/montecarlodata/issue/SEC-1056) | 🔴 Not Started |
| **6a. ECS/Fargate** | [SEC-1047](https://linear.app/montecarlodata/issue/SEC-1047) | 🔴 Not Started |
| **6b. Amplify** | [SEC-1048](https://linear.app/montecarlodata/issue/SEC-1048) | ✅ Complete |
| **7. Redis** | [SEC-1057](https://linear.app/montecarlodata/issue/SEC-1057) | 🔴 Not Started |
| **8. Monitoring** | [SEC-1058](https://linear.app/montecarlodata/issue/SEC-1058) | 🔴 Not Started |
| **9. DNS/CDN** | [SEC-1059](https://linear.app/montecarlodata/issue/SEC-1059) | 🔴 Not Started |
| **10. CI/CD** | [SEC-1060](https://linear.app/montecarlodata/issue/SEC-1060) | 🔴 Not Started |
| **11. Compliance** | [SEC-1061](https://linear.app/montecarlodata/issue/SEC-1061) | 🔴 Not Started |
| **12. Cost Management** | [SEC-1062](https://linear.app/montecarlodata/issue/SEC-1062) | 🔴 Not Started |

## High-Level Checklist

### Pre-Deployment

- [ ] AWS account created and secured
- [ ] SSO configured
- [ ] IAM roles created
- [ ] Budget alerts set up

### Infrastructure

- [ ] VPC and networking configured
- [ ] RDS PostgreSQL provisioned
- [ ] S3 buckets created
- [ ] Secrets stored in Secrets Manager
- [ ] Load balancer configured

### Application

- [ ] Compute platform chosen (ECS/Fargate or Amplify)
- [ ] Container/app deployed
- [ ] Environment variables configured
- [ ] Database migrations run

### Operations

- [ ] Monitoring and alarms configured
- [ ] DNS and SSL certificate set up
- [ ] CI/CD pipeline operational
- [ ] Compliance logging enabled

### Post-Deployment

- [ ] Smoke tests passed
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Documentation updated

## Critical Decisions

### Compute Platform

- **ECS/Fargate**: More control, container-based, traditional (~$30/month)
- **AWS Amplify**: Simpler, managed, optimized for Next.js (pricing varies)

### Redis

- **ElastiCache**: AWS-managed, requires VPC setup (~$15/month)
- **Upstash**: SaaS, no infrastructure needed (already supported by app)

### Region

- **Recommended**: `us-east-1` (most services, lowest cost)
- **Consider**: Data residency requirements

## Cost & Timeline Estimates

**Estimated Monthly Cost**: ~$130-150 for production-ready setup

**Timeline**:

- Minimal setup (Amplify + managed services): 1-2 days
- Full production setup (ECS + monitoring): 1-2 weeks

## Deployment Phases

### Phase 0: AWS Account Setup (SEC-1063)
**Must be completed first**

- [ ] Create/access AWS account
- [ ] Enable root account MFA
- [ ] Configure AWS Organizations (if multi-account)
- [ ] Set up IAM admin users
- [ ] Configure account-level security settings:
  - Default encryption
  - S3 block public access
  - Default EBS encryption
- [ ] Enable CloudTrail (account-wide)
- [ ] Enable AWS Config
- [ ] Enable GuardDuty
- [ ] Set up billing alerts
- [ ] Configure AWS CLI locally

### Phase 1: Identity & Access Management

#### 1.1 AWS SSO/IAM Identity Center (SEC-1045)
- [ ] Configure AWS IAM Identity Center
- [ ] Create permission sets:
  - Admin (full access)
  - Developer (deploy, logs, limited access)
  - Read-only (monitoring only)
- [ ] Integrate with company IdP if applicable
- [ ] Set up MFA requirements
- [ ] Document access procedures

#### 1.2 IAM Roles for Application Services (SEC-1046)
- [x] ECS/Fargate task execution role
- [x] Application runtime role with access to:
  - RDS (database connections)
  - S3 (file uploads/downloads)
  - Secrets Manager (secret retrieval)
  - CloudWatch Logs (logging)
  - CloudWatch Metrics (custom metrics)
  - X-Ray (optional tracing)
- [x] Lambda execution roles (optional, configurable)
- [x] RDS enhanced monitoring role
- [x] Document all roles and policies

**Implementation Details**:
- **Location**: `infrastructure/iam/`
- **Terraform Modules**:
  - `ecs-task-execution-role.tf` - ECS execution role with ECR, Secrets Manager, CloudWatch access
  - `app-runtime-role.tf` - Application runtime role with S3, RDS, Secrets Manager, CloudWatch access
  - `lambda-execution-roles.tf` - Optional Lambda roles for async processing (disabled by default)
  - `rds-monitoring-role.tf` - RDS enhanced monitoring role
  - `variables.tf` - Configurable variables for environments and features
  - `README.md` - Complete documentation with usage examples

**Key Features**:
- Follows principle of least privilege
- Resource-scoped policies (no wildcards except where required)
- Separate execution and runtime roles for ECS
- KMS integration for secret decryption
- Optional X-Ray tracing support
- Environment-specific resource naming

**Outputs Available**:
- `ecs_task_execution_role_arn` - For ECS task definitions
- `app_runtime_role_arn` - For ECS task definitions
- `rds_enhanced_monitoring_role_arn` - For RDS instance configuration
- `lambda_execution_role_arn` - For Lambda functions (if enabled)

**Usage**:
```bash
cd infrastructure/iam
terraform init
terraform plan -var="environment=production" -var="enable_lambda=false"
terraform apply -var="environment=production"
```

See [infrastructure/iam/README.md](../infrastructure/iam/README.md) for complete documentation.

### Phase 2: Networking Foundation

#### 2.1 VPC and Subnets (SEC-1051)
- [ ] Create VPC with appropriate CIDR (e.g., 10.0.0.0/16)
- [ ] Create public subnets in 2+ AZs (for ALB/NAT)
- [ ] Create private subnets in 2+ AZs (for app/database)
- [ ] Create Internet Gateway
- [ ] Create NAT Gateway (or NAT instance)
- [ ] Configure route tables
- [ ] Enable VPC Flow Logs

#### 2.2 Security Groups and NACLs (SEC-1053)
- [ ] ALB security group (allow 443 from 0.0.0.0/0)
- [ ] App security group (allow traffic from ALB only)
- [ ] RDS security group (allow 5432 from app SG only)
- [ ] Redis security group (allow 6379 from app SG only)
- [ ] Configure NACLs for defense in depth
- [ ] Document all security group rules

#### 2.3 Application Load Balancer (SEC-1052)
- [ ] Create ALB in public subnets
- [ ] Configure target groups
- [ ] Set up HTTPS listener (port 443)
- [ ] Request/import SSL certificate (ACM)
- [ ] Configure health checks
- [ ] Enable access logs to S3
- [ ] Set up WAF rules (optional)

### Phase 3: Data Layer

#### 3.1 RDS PostgreSQL (SEC-1049)
- [ ] Provision RDS PostgreSQL 16 instance
- [ ] Instance type: db.t3.micro (start), scale as needed
- [ ] Enable Multi-AZ for high availability
- [ ] Configure automated backups (7-35 days retention)
- [ ] Enable encryption at rest
- [ ] Enable enhanced monitoring
- [ ] Place in private subnet
- [ ] Create database: `grcminion` or `rfp_copilot`

#### 3.2 RDS Security Configuration (SEC-1050)
- [ ] Configure security groups (app access only)
- [ ] Enforce SSL/TLS connections
- [ ] Store credentials in Secrets Manager
- [ ] Configure parameter group if needed
- [ ] Set up automated snapshots
- [ ] Configure backup retention
- [ ] Document connection strings

### Phase 4: Storage

#### 4.1 S3 Buckets (SEC-1054)
Create the following buckets:
- [ ] Application file uploads bucket
  - For: CSV, Excel, PDF, Word, PPT files
  - Enable versioning
  - Enable server-side encryption (SSE-S3 or SSE-KMS)
  - Block public access
  - Configure CORS if needed
  - Set lifecycle policies
- [ ] ALB access logs bucket
- [ ] CloudTrail logs bucket
- [ ] Application logs bucket (if not using CloudWatch)

#### 4.2 S3 Access Policies (SEC-1055)
- [ ] Configure bucket policies
- [ ] Set up IAM permissions for app
- [ ] Configure signed URL generation
- [ ] Enable server access logging
- [ ] Configure cross-region replication (optional)

### Phase 5: Secrets & Configuration

#### 5.1 AWS Secrets Manager (SEC-1056)
Store the following secrets:
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `ANTHROPIC_API_KEY` - Claude API key
- [ ] `NEXTAUTH_SECRET` - NextAuth.js encryption key
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [ ] `UPSTASH_REDIS_REST_URL` - Redis URL (if using Upstash)
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Redis token
- [ ] `ENCRYPTION_KEY` - Application settings encryption

Configuration:
- [ ] Enable automatic rotation for database credentials
- [ ] Set up IAM policies for app to read secrets
- [ ] Enable encryption with KMS
- [ ] Document secret naming conventions

### Phase 6: Compute & Application

#### Option A: ECS/Fargate (SEC-1047)
- [ ] Create ECS cluster
- [ ] Create ECR repository for container images
- [ ] Build and push Docker image
- [ ] Create Fargate task definition:
  - Container: Next.js app
  - CPU: 512-1024
  - Memory: 1024-2048 MB
  - Environment variables from Secrets Manager
- [ ] Create ECS service
- [ ] Configure auto-scaling (CPU/memory based)
- [ ] Set up health checks
- [ ] Link to ALB target group

#### Option B: AWS Amplify (SEC-1048)
*Simpler alternative for Next.js apps*
- [x] Connect GitHub repository
- [x] Configure build settings:
  ```yaml
  version: 1
  frontend:
    phases:
      preBuild:
        commands:
          - npm ci --legacy-peer-deps
          - npx prisma generate
      build:
        commands:
          - npm run build
    artifacts:
      baseDirectory: .next
      files:
        - '**/*'
    cache:
      paths:
        - node_modules/**/*
  ```
- [x] Set environment variables (all secrets)
- [x] Configure custom domain
- [x] Set up branch-based deployments
- [x] Enable preview environments for PRs

**Implementation Details**:
- **Location**: `infrastructure/amplify/`
- **Terraform Modules**: main.tf, variables.tf, outputs.tf, README.md

**Components Created**:
1. **Amplify App** - Next.js hosting with automatic builds from GitHub
2. **Branch Deployments** - Main, staging, development branches
3. **Pull Request Previews** - Ephemeral environments for each PR
4. **Custom Domain Support** - Automatic SSL with ACM
5. **Environment Variables** - Parameter Store integration
6. **Basic Authentication** - Password protection for non-production
7. **CloudWatch Alarms** - Build failure and performance monitoring

**Key Features**:
- Fully managed serverless hosting
- Git-based automatic deployments
- Built-in CDN with global edge locations
- Zero-configuration Next.js SSR support
- Automatic SSL certificate management
- PR preview deployments with unique URLs
- Branch-based environments
- No server management required
- Sub-5 minute deployments
- One-click rollbacks

**Amplify vs. ECS/Fargate Comparison**:

| Aspect | Amplify | ECS/Fargate |
|--------|---------|-------------|
| **Complexity** | Low - Fully managed | Medium - More control |
| **Setup Time** | Minutes | Hours |
| **Cost (small app)** | ~$5-15/month | ~$30-50/month |
| **VPC Integration** | ❌ No | ✅ Yes |
| **PR Previews** | ✅ Built-in | ❌ Not available |
| **Custom Domains** | ✅ Easy | Requires ALB + Route 53 |
| **CI/CD** | ✅ Built-in | Manual setup needed |
| **Best For** | Simple apps, MVPs | Production apps with VPC needs |

**Secrets Management**:
Uses AWS Systems Manager Parameter Store with automatic resolution:

```bash
# Store secret in Parameter Store
aws ssm put-parameter \
  --name "/amplify/transparent-trust/production/DATABASE_URL" \
  --value "postgresql://..." \
  --type "SecureString"

# Reference in Amplify environment variable
# Variable name: AMPLIFY_DATABASE_URL
# Variable value: /amplify/transparent-trust/production/DATABASE_URL
# Access in code: process.env.DATABASE_URL (no AMPLIFY_ prefix)
```

**Required Parameter Store Secrets**:
- `/amplify/transparent-trust/production/DATABASE_URL`
- `/amplify/transparent-trust/production/NEXTAUTH_SECRET`
- `/amplify/transparent-trust/production/NEXTAUTH_URL`
- `/amplify/transparent-trust/production/ANTHROPIC_API_KEY`
- `/amplify/transparent-trust/production/GOOGLE_CLIENT_ID`
- `/amplify/transparent-trust/production/GOOGLE_CLIENT_SECRET`
- `/amplify/transparent-trust/production/UPSTASH_REDIS_REST_URL`
- `/amplify/transparent-trust/production/UPSTASH_REDIS_REST_TOKEN`
- `/amplify/transparent-trust/production/ENCRYPTION_KEY`

**Cost Estimates** (us-east-1):
- Build minutes: $0.01/min (first 1,000 free)
- Storage: $0.023/GB/month (first 15 GB free)
- Data transfer: $0.15/GB (first 15 GB free)

**Example Monthly Costs**:
- Small app (10 builds, 1 GB storage, 10 GB transfer): ~$0.50/month (essentially free)
- Medium app (50 builds, 5 GB storage, 50 GB transfer): ~$5/month
- Production (100 builds, 20 GB storage, 200 GB transfer): ~$28/month

**Usage Example**:
```hcl
module "amplify" {
  source = "./infrastructure/amplify"

  repository_url       = "https://github.com/your-org/transparent-trust"
  github_access_token  = var.github_token
  amplify_service_role_arn = aws_iam_role.amplify_service.arn

  main_branch_name = "main"
  custom_domain    = "app.example.com"

  enable_pr_previews = true
  enable_alarms      = true

  basic_auth_username = "admin"
  basic_auth_password = var.basic_auth_password

  environment = "production"
}
```

**Deployment Workflow**:
1. Push code to GitHub → Amplify automatically builds and deploys
2. Create PR → Preview environment automatically created
3. Merge PR → Main branch automatically updated
4. Access at: `https://main.d1234abcdef.amplifyapp.com` or custom domain

**Advantages**:
- ✅ Simplest deployment option
- ✅ Built-in CI/CD (no GitHub Actions needed)
- ✅ Automatic PR previews
- ✅ One-click rollbacks
- ✅ Global CDN included
- ✅ Automatic SSL certificates
- ✅ Lower cost for low-traffic apps
- ✅ No infrastructure management

**Limitations**:
- ❌ No VPC integration (cannot access private RDS)
- ❌ 30-minute build timeout
- ❌ Cold starts for SSR (~1-2s)
- ❌ 3 GB memory limit per function
- ❌ No WebSocket support
- ❌ Limited customization

**When to Use Amplify**:
- Prototypes and MVPs
- Apps using managed databases (Supabase, PlanetScale, Neon)
- Teams wanting fastest time-to-deploy
- Apps with public database endpoints
- Projects with PR preview requirements
- Budget-conscious deployments

**When to Use ECS/Fargate Instead** (SEC-1047):
- Production apps requiring VPC integration
- Apps needing private RDS/Redis access
- WebSocket requirements
- Custom networking needs
- Applications >3 GB memory
- Zero cold start requirement

See [infrastructure/amplify/README.md](../infrastructure/amplify/README.md) for complete documentation including:
- Detailed architecture diagrams
- Full setup instructions
- Parameter Store configuration
- Custom domain setup
- PR preview configuration
- Troubleshooting guide
- Cost optimization strategies

### Phase 7: Caching (SEC-1057)

#### Option A: ElastiCache Redis
- [ ] Create ElastiCache Redis cluster
- [ ] Instance: cache.t3.micro or cache.t4g.micro
- [ ] Place in private subnet
- [ ] Configure security group (app access only)
- [ ] Enable encryption in transit
- [ ] Enable automatic backups

#### Option B: Upstash Redis
*Already supported by application, no AWS infrastructure needed*
- [ ] Use existing Upstash account
- [ ] Store credentials in Secrets Manager
- [ ] Configure in application

### Phase 8: Monitoring & Logging (SEC-1058)

- [ ] Create CloudWatch Log Groups:
  - `/aws/ecs/transparent-rfp-copilot` (if using ECS)
  - `/aws/amplify/transparent-rfp-copilot` (if using Amplify)
  - `/aws/rds/postgresql/transparent-rfp-copilot`
- [ ] Configure log retention (30-90 days)
- [ ] Set up CloudWatch Alarms:
  - High error rate (> 5% for 5 minutes)
  - Database CPU > 80%
  - Database connections > 80% of max
  - ALB 5xx errors
  - High API latency (p99 > 2s)
  - Failed authentication attempts
- [ ] Create SNS topics for notifications
- [ ] Enable Container Insights (if using ECS)
- [ ] Set up custom metrics if needed

### Phase 9: DNS & CDN (SEC-1059)

- [ ] Create Route 53 hosted zone (if not exists)
- [ ] Request SSL certificate in ACM
  - Validate via DNS or email
- [ ] Create A record pointing to:
  - ALB (if using ECS/Fargate)
  - Amplify distribution (if using Amplify)
- [ ] Configure health checks
- [ ] Optional: Set up CloudFront CDN
  - For static assets
  - For global distribution
- [ ] Update `NEXTAUTH_URL` with production domain

### Phase 10: CI/CD Pipeline (SEC-1060)

#### Option A: GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Build and push to ECR
        run: |
          # Build Docker image
          # Push to ECR
          # Update ECS service
      - name: Run migrations
        run: |
          # Connect to RDS
          # Run: npx prisma migrate deploy
```

#### Option B: AWS CodePipeline
- [ ] Create CodePipeline
- [ ] Connect to GitHub
- [ ] Configure CodeBuild for:
  - Install dependencies
  - Run Prisma generate
  - Build Next.js
  - Run tests
  - Build Docker image (if ECS)
- [ ] Set up deployment stage
- [ ] Configure database migration step
- [ ] Test pipeline end-to-end

### Phase 11: Compliance & Governance (SEC-1061)

- [ ] Enable CloudTrail in all regions
- [ ] Configure CloudTrail to S3 with encryption
- [ ] Enable AWS Config
- [ ] Set up Config rules:
  - S3 bucket encryption
  - RDS encryption
  - Security group compliance
  - IAM password policy
- [ ] Enable GuardDuty for threat detection
- [ ] Set up AWS Security Hub (optional)
- [ ] Configure log retention policies
- [ ] Document compliance requirements

### Phase 12: Cost Management (SEC-1062)

- [ ] Set up AWS Budgets
  - Monthly budget alert at 50%, 80%, 100%
  - Forecasted cost alerts
- [ ] Configure cost allocation tags:
  - `Project: transparent-rfp-copilot`
  - `Environment: production`
  - `Team: security`
  - `CostCenter: [your-cost-center]`
- [ ] Enable Cost Explorer
- [ ] Review and set up Reserved Instances (after usage patterns known)
- [ ] Configure automated cost reports
- [ ] Document cost optimization opportunities

## Database Migration

Once infrastructure is ready:

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://user:pass@rds-endpoint:5432/dbname"

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db pull
```

## Environment Variables Checklist

Ensure all these are configured in your deployment environment:

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Rate Limiting (optional)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Encryption
ENCRYPTION_KEY="your-encryption-key"
```

## Post-Deployment Verification

- [ ] Access application via production URL
- [ ] Test authentication (Google OAuth)
- [ ] Upload a test RFP file
- [ ] Generate AI responses
- [ ] Check logs in CloudWatch
- [ ] Verify database connections
- [ ] Test file uploads to S3
- [ ] Verify rate limiting works
- [ ] Check all monitoring alarms are configured
- [ ] Run security scan
- [ ] Perform load testing
- [ ] Document any issues and resolutions

## Architecture Diagram

```
Internet
    |
    v
[Route 53] --> [ACM Certificate]
    |
    v
[CloudFront] (optional)
    |
    v
[Application Load Balancer]
    |
    v
[ECS Fargate / Amplify]
    |
    +-- [S3] (file uploads)
    +-- [RDS PostgreSQL]
    +-- [ElastiCache Redis / Upstash]
    +-- [Secrets Manager]
    +-- [CloudWatch Logs]
```

## Security Considerations

1. **Network Isolation**: App and database in private subnets
2. **Encryption**: At rest (RDS, S3) and in transit (HTTPS, TLS)
3. **Least Privilege**: IAM roles with minimal permissions
4. **Secrets Management**: Never hardcode secrets, use Secrets Manager
5. **Monitoring**: CloudWatch alarms for suspicious activity
6. **Compliance**: CloudTrail and Config for audit
7. **WAF**: Consider AWS WAF for ALB protection
8. **DDoS**: AWS Shield Standard included, consider Advanced

## Cost Estimates

Rough monthly costs (us-east-1):

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| ECS Fargate | 1 task (1 vCPU, 2GB) | ~$30 |
| RDS PostgreSQL | db.t3.micro, Multi-AZ | ~$30 |
| ALB | Standard usage | ~$20 |
| S3 | 100GB storage, moderate requests | ~$3 |
| NAT Gateway | 1GB data transfer | ~$35 |
| Secrets Manager | 10 secrets | ~$4 |
| CloudWatch | Standard usage | ~$10 |
| Route 53 | 1 hosted zone | ~$0.50 |
| **Total** | | **~$132/month** |

*Note: Using Amplify instead of ECS/Fargate may reduce costs*

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Check security groups allow app to RDS
- Verify DATABASE_URL is correct
- Ensure SSL is configured properly

**504 Gateway Timeout**
- Check ECS task health
- Review application logs
- Verify health check endpoint

**File Upload Failed**
- Check S3 bucket permissions
- Verify IAM role has S3 access
- Check bucket CORS configuration

**Authentication Not Working**
- Verify NEXTAUTH_URL matches domain
- Check Google OAuth redirect URIs
- Verify NEXTAUTH_SECRET is set

## Related Documentation

- [DATABASE_SETUP.md](../DATABASE_SETUP.md) - Local database setup
- [docs/runbooks/deploy.md](./runbooks/deploy.md) - Deployment procedures
- [docs/runbooks/rollback.md](./runbooks/rollback.md) - Rollback procedures
- [docs/runbooks/incident-response.md](./runbooks/incident-response.md) - Incident response

## Support

For questions or issues:
- Linear: [SEC-1044](https://linear.app/montecarlodata/issue/SEC-1044/transparent-trust-aws-deployment-infrastructure)
- Repository: [transparent-rfp-copilot](https://github.com/your-org/transparent-rfp-copilot)
