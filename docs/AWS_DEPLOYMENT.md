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
| **5. Secrets Manager** | [SEC-1056](https://linear.app/montecarlodata/issue/SEC-1056) | ✅ Complete |
| **6a. ECS/Fargate** | [SEC-1047](https://linear.app/montecarlodata/issue/SEC-1047) | ✅ Complete |
| **6b. Amplify** | [SEC-1048](https://linear.app/montecarlodata/issue/SEC-1048) | 🔴 Not Started |
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
- [x] `DATABASE_URL` - PostgreSQL connection string
- [x] `ANTHROPIC_API_KEY` - Claude API key
- [x] `NEXTAUTH_SECRET` - NextAuth.js encryption key
- [x] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [x] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [x] `UPSTASH_REDIS_REST_URL` - Redis URL (if using Upstash)
- [x] `UPSTASH_REDIS_REST_TOKEN` - Redis token
- [x] `ENCRYPTION_KEY` - Application settings encryption

Configuration:
- [x] Enable automatic rotation for database credentials
- [x] Set up IAM policies for app to read secrets
- [x] Enable encryption with KMS
- [x] Document secret naming conventions

**Implementation Details**:
- **Location**: `infrastructure/secrets-manager/`
- **Terraform Modules**: main.tf, variables.tf, outputs.tf, README.md

**Secrets Created**:
1. **NextAuth Secret** - Auto-generated 32-char password for session encryption
2. **Anthropic API Key** - Claude API access (provided value)
3. **Google OAuth** - Client ID & secret (JSON format)
4. **Upstash Redis** - URL & token (JSON, optional)
5. **Encryption Key** - Auto-generated for app settings
6. **RDS Database** - Imported from RDS module
7. **Custom Secrets** - Extensible for additional secrets

**Key Features**:
- Automatic KMS encryption for all secrets
- IAM policy for application access (GetSecretValue, DescribeSecret)
- Auto-generated strong passwords (NextAuth, encryption key)
- Optional RDS credential rotation (Lambda-based, 30-day default)
- Recovery window (30 days) for accidental deletion
- CloudWatch alarms for access monitoring
- ECS task definition integration
- Version control for secrets

**Security**:
- All secrets encrypted at rest with KMS
- Least privilege IAM access
- No secrets in code or Terraform state (sensitive variables)
- Audit trail via CloudTrail
- Access monitoring with CloudWatch

**Automatic Rotation** (RDS):
- Lambda function in VPC for RDS access
- Configurable rotation period (default: 30 days)
- Automatic password generation & testing
- Zero-downtime credential updates
- CloudWatch monitoring

**Usage Examples**:
```typescript
// Application code
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string) {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString;
}

const anthropicKey = await getSecret("transparent-rfp-anthropic-api-key-production");
```

```json
// ECS Task Definition
{
  "secrets": [
    {
      "name": "NEXTAUTH_SECRET",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:xxx:secret:transparent-rfp-nextauth-secret-production"
    },
    {
      "name": "GOOGLE_CLIENT_ID",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:xxx:secret:transparent-rfp-google-oauth-production:client_id::"
    }
  ]
}
```

See [infrastructure/secrets-manager/README.md](../infrastructure/secrets-manager/README.md) for complete documentation.

### Phase 6: Compute & Application

#### Option A: ECS/Fargate (SEC-1047)
- [x] Create ECS cluster
- [x] Create ECR repository for container images
- [x] Build and push Docker image
- [x] Create Fargate task definition:
  - Container: Next.js app
  - CPU: 512-1024
  - Memory: 1024-2048 MB
  - Environment variables from Secrets Manager
- [x] Create ECS service
- [x] Configure auto-scaling (CPU/memory based)
- [x] Set up health checks
- [x] Link to ALB target group

**Implementation Details**:
- **Location**: `infrastructure/ecs/`
- **Terraform Modules**: main.tf, variables.tf, outputs.tf, README.md

**Components Created**:
1. **ECS Cluster** - Fargate serverless cluster with Container Insights
2. **ECR Repository** - Docker image registry with lifecycle policies and vulnerability scanning
3. **ECS Task Definition** - Containerized Next.js app with secrets injection
4. **ECS Service** - Auto-scaling service with ALB integration
5. **Security Groups** - Network isolation for ECS tasks
6. **CloudWatch Logs** - Centralized application logging
7. **Auto Scaling** - CPU and memory-based scaling (min 2, max 10 tasks)
8. **CloudWatch Alarms** - Monitoring for CPU, memory, and task health

**Key Features**:
- Serverless Fargate (no EC2 management)
- Multi-AZ high availability
- Zero-downtime rolling deployments
- Automatic secrets injection from Secrets Manager
- Container Insights for advanced monitoring
- ECR vulnerability scanning on image push
- Health checks (container + ALB)
- Optional Fargate Spot for cost savings
- KMS encryption for logs and images
- Security group with least privilege access

**Task Configuration**:
- Default: 512 CPU (.5 vCPU), 1024 MB memory
- Production: 1024 CPU (1 vCPU), 2048 MB memory
- Supports: 256-4096 CPU, 512 MB-30 GB memory

**Auto Scaling**:
- Target: 70% CPU, 80% memory utilization
- Scale in cooldown: 300 seconds
- Scale out cooldown: 60 seconds
- Min capacity: 2 tasks
- Max capacity: 10 tasks

**Cost Estimates** (us-east-1):
- Development (256 CPU, 512 MB, 1 task): ~$10/month
- Production (512 CPU, 1024 MB, 2 tasks): ~$30/month
- High availability (1024 CPU, 2048 MB, 3 tasks): ~$90/month

**Usage Example**:
```hcl
module "ecs" {
  source = "./infrastructure/ecs"

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn   = module.alb.target_group_arn

  ecs_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn      = module.iam.app_runtime_role_arn

  database_secret_arn        = module.secrets.database_secret_arn
  nextauth_secret_arn        = module.secrets.nextauth_secret_arn
  anthropic_secret_arn       = module.secrets.anthropic_secret_arn
  google_oauth_secret_arn    = module.secrets.google_oauth_secret_arn
  encryption_key_secret_arn  = module.secrets.encryption_key_secret_arn
  redis_secret_arn           = module.secrets.redis_secret_arn

  nextauth_url = "https://app.example.com"
  environment  = "production"
}
```

**Deployment Workflow**:
```bash
# 1. Build Docker image
docker build -t transparent-trust:latest .

# 2. Tag and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ecr-url>
docker tag transparent-trust:latest <ecr-url>/transparent-trust-production:latest
docker push <ecr-url>/transparent-trust-production:latest

# 3. Deploy to ECS
aws ecs update-service --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production --force-new-deployment

# 4. Monitor deployment
aws logs tail /aws/ecs/transparent-trust-production --follow
```

**Dockerfile Requirements**:
- Multi-stage build for optimization
- Next.js standalone output mode
- Non-root user for security
- Health check endpoint at `/api/health`
- Expose port 3000

**CI/CD Integration**:
Complete GitHub Actions workflow included in README for automated deployments on push to main branch.

See [infrastructure/ecs/README.md](../infrastructure/ecs/README.md) for complete documentation including:
- Detailed architecture diagrams
- Full Dockerfile example
- CI/CD pipeline templates
- Monitoring and troubleshooting guides
- Security best practices
- Cost optimization strategies

#### Option B: AWS Amplify (SEC-1048)
*Simpler alternative for Next.js apps*
- [ ] Connect GitHub repository
- [ ] Configure build settings:
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
- [ ] Set environment variables (all secrets)
- [ ] Configure custom domain
- [ ] Set up branch-based deployments
- [ ] Enable preview environments for PRs

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
