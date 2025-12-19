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
| **4.2 S3 Policies** | [SEC-1055](https://linear.app/montecarlodata/issue/SEC-1055) | ✅ Complete |
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
- [x] Configure bucket policies
- [x] Set up IAM permissions for app
- [x] Configure signed URL generation
- [x] Enable server access logging
- [x] Configure cross-region replication (optional)

**Implementation Details**:
- **Location**: `infrastructure/s3-policies/`
- **Terraform Modules**:
  - `main.tf` - IAM policies, bucket policies, S3 Access Points, replication roles
  - `variables.tf` - Configuration variables for policy creation
  - `outputs.tf` - Policy ARNs, role ARNs, Access Point details
  - `README.md` - Comprehensive documentation with signed URL examples and security best practices

**IAM Policies Created**:

1. **Application S3 Access Policy**:
   - Purpose: Full CRUD operations for application on S3 buckets
   - Permissions: PutObject, GetObject, DeleteObject, ListBucket, version operations
   - KMS Access: Decrypt, GenerateDataKey (if KMS encryption enabled)
   - Conditions: Enforce encryption on uploads
   - Scope: Specific bucket only (least privilege)
   - Automatic attachment to application IAM role

2. **Read-Only S3 Access Policy** (optional):
   - Purpose: Read-only access for analytics, reporting, auditing
   - Permissions: GetObject, GetObjectVersion, ListBucket, bucket metadata
   - Use Cases: BI tools, reporting systems, data science, audit log analysis
   - KMS Access: Decrypt only (if KMS enabled)

3. **Lambda S3 Access Policy** (optional):
   - Purpose: Lambda function file processing
   - Permissions: GetObject, PutObject, ListBucket
   - Use Cases: Format conversion, thumbnails, text extraction, virus scanning
   - KMS Access: Decrypt and GenerateDataKey (if KMS enabled)

4. **S3 Replication Policy** (optional):
   - Purpose: Cross-region replication for disaster recovery
   - Source Permissions: Read replication config, get objects/versions
   - Destination Permissions: Write replicated objects
   - KMS Access: Decrypt from source, encrypt to destination
   - IAM Role: Dedicated replication role with AssumeRole policy
   - Use Cases: Disaster recovery, compliance, data sovereignty

**Bucket Policies (Resource-Based)**:
- **SSL/TLS Enforcement**: Deny all requests without `aws:SecureTransport`
- **Encryption Enforcement**: Deny PutObject without proper encryption header
- **Application Role Access**: Explicitly allow application role
- **Defense in Depth**: Both identity-based (IAM) and resource-based (bucket) policies

**S3 Access Points** (optional):
- Purpose: Simplify data access management for shared datasets
- Features: Unique hostname, dedicated policy, optional VPC restriction
- Benefits: Simplified management, network isolation, app-specific access
- VPC Integration: Restrict access to VPC only for sensitive data
- Access Point Policy: Separate from bucket policy for cleaner management

**Signed URL Generation**:
- **Upload URLs**: Presigned PUT for browser uploads (15 min expiration)
- **Download URLs**: Presigned GET for time-limited downloads (1 hour expiration)
- **Security**: Enforce encryption, validate file types, user authentication required
- **Implementation**: Complete TypeScript/Node.js examples provided
- **API Routes**: Next.js API route examples for URL generation
- **Frontend**: React component example for file uploads

**Cross-Region Replication Setup**:
- **Disaster Recovery**: Protect against regional failures
- **Compliance**: Meet data residency requirements
- **Configuration**: Replication role, source/destination bucket setup
- **Versioning**: Required on both source and destination buckets
- **KMS Support**: Replicate encrypted objects with destination KMS key
- **Monitoring**: CloudWatch metrics for replication latency and status

**Security Best Practices**:
1. **Least Privilege**: Only grant necessary permissions, scope to specific buckets
2. **Encryption**: Enforce at rest (AES256/KMS) and in transit (SSL/TLS)
3. **Access Control**: Both IAM and bucket policies (defense in depth)
4. **Monitoring**: S3 access logs, CloudTrail data events, CloudWatch alarms
5. **Data Protection**: Versioning, replication, lifecycle policies, MFA delete

**Configuration Flags**:
- `create_readonly_policy` - Create read-only policy (default: true)
- `create_lambda_policy` - Create Lambda policy (default: false)
- `create_bucket_policies` - Create bucket policies (default: true)
- `create_access_point` - Create S3 Access Point (default: false)
- `enable_replication` - Enable cross-region replication (default: false)
- `use_kms_encryption` - Adjust policies for KMS (default: false)

**Policy Conditions**:
- Encryption enforcement: `s3:x-amz-server-side-encryption` must be AES256 or aws:kms
- SSL/TLS requirement: `aws:SecureTransport` must be true
- KMS key scope: Specific KMS key ARN only
- Resource scope: Specific bucket ARN and bucket/* only

**Signed URL Security**:
- **Short Expiration**: 5-15 min for uploads, 1 hour for downloads
- **File Type Validation**: Only generate URLs for allowed file types
- **User Authentication**: Require auth before generating URLs
- **Rate Limiting**: Limit URLs per user per time period
- **Key Uniqueness**: UUID or timestamp to prevent collisions
- **Logging**: Log all URL generation for audit trail

**Application Integration Examples**:
```typescript
// Generate presigned upload URL
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

// API route for presigned URL
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileName, fileType } = await request.json();
  const key = `uploads/${session.user.id}/${Date.now()}-${fileName}`;
  const uploadUrl = await generateUploadUrl(key, fileType, 900);

  return NextResponse.json({ uploadUrl, key, expiresIn: 900 });
}
```

**Cross-Region Replication Configuration**:
```bash
# Enable versioning on source
aws s3api put-bucket-versioning \
  --bucket transparent-rfp-uploads-production \
  --versioning-configuration Status=Enabled

# Configure replication
aws s3api put-bucket-replication \
  --bucket transparent-rfp-uploads-production \
  --replication-configuration '{
    "Role": "<replication-role-arn>",
    "Rules": [{
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::backup-bucket",
        "ReplicationTime": { "Status": "Enabled", "Time": { "Minutes": 15 } }
      }
    }]
  }'
```

**Usage**:
```bash
cd infrastructure/s3-policies
terraform init

# Basic deployment
terraform apply \
  -var="project_name=transparent-rfp" \
  -var="environment=production" \
  -var="app_uploads_bucket_id=transparent-rfp-uploads-production" \
  -var="app_uploads_bucket_arn=arn:aws:s3:::bucket" \
  -var="app_role_name=transparent-rfp-app-role" \
  -var="app_role_arn=arn:aws:iam::123456789012:role/app-role"

# With KMS, Lambda, and replication
terraform apply \
  -var="project_name=transparent-rfp" \
  -var="environment=production" \
  -var="use_kms_encryption=true" \
  -var="kms_key_arn=arn:aws:kms:us-east-1:123456789012:key/xxx" \
  -var="create_lambda_policy=true" \
  -var="enable_replication=true" \
  -var="replication_destination_bucket_arn=arn:aws:s3:::backup"
```

**Outputs Available**:
- Application S3 access policy ARN (for manual attachment if needed)
- Read-only policy ARN (attach to analytics roles)
- Lambda policy ARN (attach to Lambda execution roles)
- Replication policy ARN and role ARN (for replication setup)
- S3 Access Point ARN and alias (if created)
- Summary object with all policy details

**Key Features**:
- Modular policy creation (enable/disable each policy type)
- Least privilege access with resource scoping
- Defense-in-depth security (IAM + bucket policies)
- Complete signed URL implementation examples
- Cross-region replication support
- S3 Access Points for advanced access control
- KMS integration for encrypted buckets
- Comprehensive documentation with security best practices

See [infrastructure/s3-policies/README.md](../infrastructure/s3-policies/README.md) for complete documentation including:
- Detailed policy descriptions
- Signed URL generation examples (TypeScript/Node.js)
- Frontend upload component examples (React)
- Cross-region replication setup guide
- S3 Access Point configuration
- Security best practices
- Application integration examples

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
