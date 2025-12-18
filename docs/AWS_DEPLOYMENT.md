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
| **2.1 VPC** | [SEC-1051](https://linear.app/montecarlodata/issue/SEC-1051) | ✅ Complete |
| **2.2 Security Groups** | [SEC-1053](https://linear.app/montecarlodata/issue/SEC-1053) | ✅ Complete |
| **2.3 Load Balancer** | [SEC-1052](https://linear.app/montecarlodata/issue/SEC-1052) | ✅ Complete |
| **3.1 RDS PostgreSQL** | [SEC-1049](https://linear.app/montecarlodata/issue/SEC-1049) | ✅ Complete |
| **3.2 RDS Security** | [SEC-1050](https://linear.app/montecarlodata/issue/SEC-1050) | 🔴 Not Started |
| **4.1 S3 Buckets** | [SEC-1054](https://linear.app/montecarlodata/issue/SEC-1054) | 🔴 Not Started |
| **4.2 S3 Policies** | [SEC-1055](https://linear.app/montecarlodata/issue/SEC-1055) | 🔴 Not Started |
| **5. Secrets Manager** | [SEC-1056](https://linear.app/montecarlodata/issue/SEC-1056) | 🔴 Not Started |
| **6a. ECS/Fargate** | [SEC-1047](https://linear.app/montecarlodata/issue/SEC-1047) | 🔴 Not Started |
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
- [x] Create VPC with appropriate CIDR (e.g., 10.0.0.0/16)
- [x] Create public subnets in 2+ AZs (for ALB/NAT)
- [x] Create private subnets in 2+ AZs (for app/database)
- [x] Create Internet Gateway
- [x] Create NAT Gateway (or NAT instance)
- [x] Configure route tables
- [x] Enable VPC Flow Logs

**Implementation Details**:
- **Location**: `infrastructure/vpc/`
- **Terraform Module**: Complete VPC infrastructure with multi-AZ deployment
- **VPC CIDR**: 10.0.0.0/16
- **Subnet Allocation**:
  - Public subnets: 10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24 (us-east-1a/b/c)
  - Private subnets: 10.0.3.0/24, 10.0.4.0/24, 10.0.5.0/24 (us-east-1a/b/c)
- **NAT Gateways**: 3 NAT Gateways (1 per AZ) for high availability
- **VPC Flow Logs**: Enabled with CloudWatch Logs integration, 7-day retention

**Key Features**:
- Multi-AZ deployment across 3 availability zones
- Separate public and private subnets for network isolation
- NAT Gateways in each AZ for private subnet internet access
- Internet Gateway for public subnet internet access
- Proper route table configuration for public/private routing
- VPC Flow Logs for network traffic monitoring
- DNS hostnames and DNS support enabled

**Usage**:
```bash
cd infrastructure/vpc
terraform init
terraform plan -var="environment=production"
terraform apply -var="environment=production"
```

See [infrastructure/vpc/README.md](../infrastructure/vpc/README.md) for complete documentation.

#### 2.2 Security Groups and NACLs (SEC-1053)
- [x] ALB security group (allow 443 from 0.0.0.0/0)
- [x] App security group (allow traffic from ALB only)
- [x] RDS security group (allow 5432 from app SG only)
- [x] Redis security group (allow 6379 from app SG only)
- [x] Configure NACLs for defense in depth
- [x] Document all security group rules

**Implementation Details**:
- **Location**: `infrastructure/security-groups/`
- **Terraform Modules**:
  - `main.tf` - Security groups for ALB, App, RDS, Redis, and VPC Endpoints
  - `nacls.tf` - Network ACLs for public and private subnets
  - `variables.tf` - Configuration variables
  - `outputs.tf` - Security group IDs for cross-module references
  - `README.md` - Complete documentation

**Security Groups**:
- **ALB SG**: Ingress HTTPS (443) and HTTP (80) from internet, egress to App on port 3000
- **App SG**: Ingress from ALB (3000), egress to RDS (5432), Redis (6379), HTTPS (443)
- **RDS SG**: Ingress from App SG only on port 5432
- **Redis SG**: Ingress from App SG only on port 6379
- **VPC Endpoint SG**: Ingress from App SG on port 443 (for S3, Secrets Manager, etc.)

**Network ACLs** (optional, enabled via variable):
- Public subnet NACLs: Allow inbound HTTP/HTTPS from internet, ephemeral ports, SSH from bastion
- Private subnet NACLs: Allow traffic from VPC CIDR, deny external access
- Defense-in-depth security alongside security groups

**Key Features**:
- Security group references instead of CIDR blocks (more secure)
- Least privilege: Only necessary ports and sources
- Stateful filtering via security groups
- Optional stateless filtering via NACLs
- VPC endpoint security groups for AWS service access

**Usage**:
```bash
cd infrastructure/security-groups
terraform init
terraform plan -var="environment=production" -var="vpc_id=vpc-xxx" -var="vpc_cidr=10.0.0.0/16"
terraform apply -var="environment=production"
```

See [infrastructure/security-groups/README.md](../infrastructure/security-groups/README.md) for complete documentation.

#### 2.3 Application Load Balancer (SEC-1052)
- [x] Create ALB in public subnets
- [x] Configure target groups
- [x] Set up HTTPS listener (port 443)
- [x] Request/import SSL certificate (ACM)
- [x] Configure health checks
- [x] Enable access logs to S3
- [x] Set up WAF rules (optional)

**Implementation Details**:
- **Location**: `infrastructure/alb/`
- **Terraform Modules**:
  - `main.tf` - ALB, listeners, target groups, S3 bucket for logs, CloudWatch alarms
  - `variables.tf` - Configuration variables
  - `outputs.tf` - ALB DNS, ARN, target group ARN, zone ID
  - `README.md` - Complete documentation

**ALB Configuration**:
- **Type**: Application Load Balancer (internet-facing)
- **Subnets**: Deployed in all public subnets (multi-AZ)
- **Target Group**: IP-based targeting for ECS Fargate (port 3000)
- **Health Check**: GET /api/health endpoint
  - Interval: 30 seconds
  - Timeout: 5 seconds
  - Healthy threshold: 2
  - Unhealthy threshold: 3
- **HTTP to HTTPS Redirect**: Automatic redirect from port 80 to 443
- **HTTPS Listener**: Port 443 with ACM certificate (variable: certificate_arn)
- **SSL Policy**: ELBSecurityPolicy-TLS13-1-2-2021-06 (TLS 1.2 and 1.3 only)

**Access Logs**:
- Stored in dedicated S3 bucket with encryption
- Bucket lifecycle policy for automatic cleanup (90 days default)
- ALB service account permissions configured

**CloudWatch Alarms**:
- Unhealthy target count > 0 for 5 minutes
- HTTPCode_Target_5XX_Count > 10 in 5 minutes
- TargetResponseTime p99 > 2 seconds

**Key Features**:
- Multi-AZ deployment for high availability
- HTTPS-only traffic with modern SSL policy
- Comprehensive health checks
- Access logging for compliance and debugging
- CloudWatch alarms for proactive monitoring
- Connection draining for graceful shutdowns

**Usage**:
```bash
cd infrastructure/alb
terraform init
terraform plan -var="environment=production" \
  -var="vpc_id=vpc-xxx" \
  -var="public_subnet_ids=[\"subnet-xxx\",\"subnet-yyy\"]" \
  -var="alb_security_group_id=sg-xxx" \
  -var="certificate_arn=arn:aws:acm:..."
terraform apply -var="environment=production"
```

See [infrastructure/alb/README.md](../infrastructure/alb/README.md) for complete documentation.

### Phase 3: Data Layer

#### 3.1 RDS PostgreSQL (SEC-1049)
- [x] Provision RDS PostgreSQL 16 instance
- [x] Instance type: db.t3.micro (start), scale as needed
- [x] Enable Multi-AZ for high availability
- [x] Configure automated backups (7-35 days retention)
- [x] Enable encryption at rest
- [x] Enable enhanced monitoring
- [x] Place in private subnet
- [x] Create database: `grcminion` or `rfp_copilot`

**Implementation Details**:
- **Location**: `infrastructure/rds/`
- **Terraform Modules**:
  - `main.tf` - RDS instance, subnet group, parameter group, KMS key, Secrets Manager, CloudWatch alarms
  - `variables.tf` - 50+ configuration variables for complete customization
  - `outputs.tf` - Database endpoint, connection details, credentials secret ARN
  - `README.md` - Comprehensive 600+ line documentation

**RDS Configuration**:
- **Engine**: PostgreSQL 16 (latest)
- **Instance Class**: db.t3.micro (configurable, can scale to db.r6g.xlarge+)
- **Storage**: 20GB allocated, up to 100GB max (auto-scaling enabled)
- **Storage Type**: gp3 (latest generation with better performance)
- **Multi-AZ**: Enabled for automatic failover and high availability
- **Database Name**: Configurable via variable (default: app database)
- **Port**: 5432 (standard PostgreSQL)

**High Availability & Backup**:
- Multi-AZ deployment with synchronous replication
- Automated daily backups with 7-day retention (configurable 7-35 days)
- Backup window: 03:00-04:00 UTC (configurable)
- Maintenance window: Sun:04:00-Sun:05:00 UTC (configurable)
- Point-in-time recovery enabled
- Final snapshot created on deletion (configurable)

**Security**:
- Encryption at rest using AWS KMS with automatic key rotation
- Encryption in transit enforced via parameter group (rds.force_ssl=1)
- Master credentials stored in AWS Secrets Manager
- IAM database authentication support (optional)
- Deployed in private subnets only
- Security group restricts access to app tier only
- Deletion protection enabled (configurable)

**Monitoring & Logging**:
- Enhanced monitoring with 60-second granularity
- Performance Insights enabled with 7-day retention
- CloudWatch Logs for PostgreSQL logs
- CloudWatch Alarms for:
  - CPU utilization > 80%
  - Freeable memory < 256MB
  - Free storage space < 2GB
  - Database connections > 80% of max
- SNS topic integration for alarm notifications (optional)

**Parameter Group**:
- Custom parameter group with production-ready settings:
  - SSL enforcement (rds.force_ssl=1)
  - Enhanced logging (log_connections, log_disconnections, log_statement=ddl)
  - Optimized for application workloads

**Subnet Group**:
- Spans all private subnets across multiple AZs
- Ensures database can failover to any AZ
- Provides network isolation from internet

**Credentials Management**:
- Master username and password generated securely
- Stored in AWS Secrets Manager
- Automatic rotation supported (can be enabled)
- Retrieved by application at runtime

**Key Features**:
- Production-ready configuration with best practices
- Fully configurable via variables (50+ options)
- Comprehensive monitoring and alerting
- Automatic backups and point-in-time recovery
- Encryption at rest and in transit
- Multi-AZ for high availability
- Auto-scaling storage
- Performance Insights for query optimization
- Complete documentation with troubleshooting guides

**Cost Estimates** (us-east-1):
- db.t3.micro Multi-AZ: ~$30/month
- db.t4g.micro Multi-AZ: ~$27/month (ARM-based, better value)
- db.t3.small Multi-AZ: ~$60/month
- Storage (20GB): ~$4.60/month
- Backups (within retention): Free
- Enhanced Monitoring: ~$1.50/month
- KMS key: $1/month

**Usage**:
```bash
cd infrastructure/rds
terraform init

# Review variables and customize as needed
# Recommended: Create terraform.tfvars file

terraform plan \
  -var="environment=production" \
  -var="project_name=transparent-rfp" \
  -var="vpc_id=vpc-xxx" \
  -var="private_subnet_ids=[\"subnet-xxx\",\"subnet-yyy\",\"subnet-zzz\"]" \
  -var="app_security_group_id=sg-xxx" \
  -var="db_name=rfp_copilot" \
  -var="multi_az=true" \
  -var="backup_retention_period=7"

terraform apply -var="environment=production"
```

**Post-Deployment**:
1. Retrieve database credentials from Secrets Manager
2. Update application environment variables with DATABASE_URL
3. Run Prisma migrations: `npx prisma migrate deploy`
4. Verify connectivity and SSL enforcement
5. Test automatic failover (optional)

**Connection Example**:
```bash
# Retrieve credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-db-credentials-production \
  --query SecretString --output text | jq -r '.password'

# Connect via psql
psql "postgresql://dbadmin:PASSWORD@transparent-rfp-db-production.xxxxx.us-east-1.rds.amazonaws.com:5432/rfp_copilot?sslmode=require"
```

See [infrastructure/rds/README.md](../infrastructure/rds/README.md) for complete documentation including:
- Detailed variable descriptions
- Migration procedures with Prisma
- Troubleshooting guides (connection, SSL, performance)
- Backup and recovery procedures
- Maintenance best practices
- Security hardening recommendations

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
