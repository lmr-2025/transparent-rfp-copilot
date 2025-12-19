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
| **3.2 RDS Security** | [SEC-1050](https://linear.app/montecarlodata/issue/SEC-1050) | ✅ Complete |
| **4.1 S3 Buckets** | [SEC-1054](https://linear.app/montecarlodata/issue/SEC-1054) | ✅ Complete |
| **4.2 S3 Policies** | [SEC-1055](https://linear.app/montecarlodata/issue/SEC-1055) | ✅ Complete |
| **5. Secrets Manager** | [SEC-1056](https://linear.app/montecarlodata/issue/SEC-1056) | ✅ Complete |
| **6a. ECS/Fargate** | [SEC-1047](https://linear.app/montecarlodata/issue/SEC-1047) | ✅ Complete |
| **6b. Amplify** | [SEC-1048](https://linear.app/montecarlodata/issue/SEC-1048) | ✅ Complete |
| **7. Redis** | [SEC-1057](https://linear.app/montecarlodata/issue/SEC-1057) | ✅ Complete |
| **8. Monitoring** | [SEC-1058](https://linear.app/montecarlodata/issue/SEC-1058) | ✅ Complete |
| **9. DNS/CDN** | [SEC-1059](https://linear.app/montecarlodata/issue/SEC-1059) | ✅ Complete |
| **10. CI/CD** | [SEC-1060](https://linear.app/montecarlodata/issue/SEC-1060) | ✅ Complete |
| **11. Compliance** | [SEC-1061](https://linear.app/montecarlodata/issue/SEC-1061) | ✅ Complete |
| **12. Cost Management** | [SEC-1062](https://linear.app/montecarlodata/issue/SEC-1062) | ✅ Complete |

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
- [x] Configure security groups (app access only)
- [x] Enforce SSL/TLS connections
- [x] Store credentials in Secrets Manager
- [x] Configure parameter group if needed
- [x] Set up automated snapshots
- [x] Configure backup retention
- [x] Document connection strings

**Implementation Details**:
- **Location**: `docs/RDS_SECURITY.md` and `docs/runbooks/rds-security-monitoring.md`
- **Documentation Type**: Security hardening, operational procedures, compliance

**RDS Security Documentation**:
- **RDS_SECURITY.md** - Comprehensive security configuration guide:
  - Security layers overview (network, auth, encryption, monitoring, backup)
  - Initial security setup and verification procedures
  - Credential management and rotation procedures
  - Network security configuration and verification
  - Encryption at rest and in transit setup
  - Access control and database user management
  - Monitoring and auditing procedures
  - Security hardening checklist (initial, post-deployment, monthly, quarterly)
  - Incident response procedures (detection, containment, investigation, recovery)
  - Compliance framework coverage (SOC 2, HIPAA, PCI DSS, GDPR)
  - Security testing procedures (penetration testing, vulnerability assessment, load testing)
  - Troubleshooting guide for common security issues

**Security Monitoring Runbook**:
- **rds-security-monitoring.md** - Operational procedures for security monitoring:
  - Daily security checks (alarms, failed logins, connections, CloudTrail, performance)
  - Weekly security review (user audit, security groups, query patterns, logs, backups)
  - Monthly security audit (configuration review, access control, network, encryption, logs, compliance)
  - Security alert response procedures (high connections, failed auth, high CPU)
  - Credential rotation procedures (monthly schedule, automation)
  - Security incident response workflow (detection, containment, investigation, recovery, post-incident)
  - Compliance reporting (monthly reports, audit evidence collection)

**Key Security Features Documented**:
- **Authentication & Authorization**:
  - Master credentials in Secrets Manager
  - Application-specific database users with least privilege
  - IAM database authentication setup
  - Password policy and rotation
  - Connection limits per user

- **Network Security**:
  - Private subnet placement verification
  - Security group rule auditing
  - NACL configuration (optional)
  - VPC Flow Logs monitoring

- **Encryption**:
  - KMS encryption at rest verification
  - Automatic key rotation
  - SSL/TLS enforcement (rds.force_ssl=1)
  - Certificate validation setup

- **Monitoring & Logging**:
  - CloudWatch Logs analysis
  - Enhanced monitoring metrics
  - Performance Insights usage
  - CloudWatch Alarms configuration
  - CloudTrail API auditing

- **Incident Response**:
  - Unauthorized access response
  - Suspicious activity detection
  - Configuration change review
  - Data breach procedures
  - Evidence preservation

- **Compliance**:
  - SOC 2 control documentation
  - HIPAA requirements
  - PCI DSS requirements
  - GDPR requirements
  - Audit evidence collection

**Security Checklists**:
- Initial deployment verification (15 items)
- Post-deployment hardening (15 items)
- Monthly maintenance tasks (14 items)
- Quarterly security audit (12 items)

**Operational Procedures**:
- Daily security checks (10-15 minutes)
- Weekly security review (30-45 minutes)
- Monthly security audit (2-3 hours)
- Credential rotation (monthly, 15-20 minutes)
- Incident response workflow (5-phase process)
- Compliance reporting (monthly and quarterly)

**Response Times**:
- Critical alerts: < 5 minutes
- Authentication failures: < 15 minutes
- Performance alerts: < 10 minutes
- Weekly review: Within 24 hours
- Monthly audit: Within first week of month

**Tools & Commands**:
- AWS CLI commands for all verification and monitoring tasks
- SQL queries for database user and permission auditing
- Log analysis scripts for security event detection
- CloudWatch metrics queries for performance monitoring
- CloudTrail commands for API activity review

**Best Practices Covered**:
- Defense-in-depth security architecture
- Principle of least privilege for all access
- Regular credential rotation (30-90 days)
- Comprehensive logging and monitoring
- Automated compliance checking
- Incident response planning
- Security testing and vulnerability assessment

See [docs/RDS_SECURITY.md](./RDS_SECURITY.md) for complete security configuration guide.
See [docs/runbooks/rds-security-monitoring.md](./runbooks/rds-security-monitoring.md) for operational procedures.

### Phase 4: Storage

#### 4.1 S3 Buckets (SEC-1054)
Create the following buckets:
- [x] Application file uploads bucket
  - For: CSV, Excel, PDF, Word, PPT files
  - Enable versioning
  - Enable server-side encryption (SSE-S3 or SSE-KMS)
  - Block public access
  - Configure CORS if needed
  - Set lifecycle policies
- [x] ALB access logs bucket
- [x] CloudTrail logs bucket
- [x] General logs bucket (for S3 access logs and application logs)

**Implementation Details**:
- **Location**: `infrastructure/s3/`
- **Terraform Modules**:
  - `main.tf` - S3 buckets, KMS encryption, CloudWatch alarms, bucket policies
  - `variables.tf` - 30+ configuration variables
  - `outputs.tf` - Bucket names, ARNs, domain names
  - `README.md` - Comprehensive documentation with usage examples

**Buckets Created**:

1. **Application Uploads Bucket** (`{project}-uploads-{env}`):
   - Purpose: User-uploaded documents (PDF, CSV, Excel, Word, PPT)
   - Versioning: Enabled (configurable)
   - Encryption: AES256 or KMS (configurable)
   - CORS: Enabled for web uploads
   - Lifecycle: 90d → IA, 180d → Glacier, optional expiration
   - Access Logging: Enabled (logs to general logs bucket)
   - Public Access: Blocked
   - CloudWatch Alarms: Bucket size, 4xx errors

2. **ALB Access Logs Bucket** (`{project}-alb-logs-{env}`):
   - Purpose: Application Load Balancer access logs
   - Encryption: AES256
   - Lifecycle: 30d → IA, 90d → Glacier, expire after 90d (configurable)
   - Bucket Policy: Allow ELB service to write logs
   - Public Access: Blocked

3. **CloudTrail Logs Bucket** (`{project}-cloudtrail-logs-{env}`):
   - Purpose: AWS API audit logs for compliance
   - Encryption: AES256
   - Lifecycle: 90d → IA, 180d → Glacier, expire after 365d (configurable)
   - Bucket Policy: Allow CloudTrail service to write logs
   - Public Access: Blocked
   - Compliance: SOC 2, HIPAA, PCI DSS

4. **General Logs Bucket** (`{project}-logs-{env}`):
   - Purpose: S3 access logs and miscellaneous application logs
   - Encryption: AES256
   - Lifecycle: 30d → IA, 90d → Glacier, expire after 90d (configurable)
   - Bucket Policy: Allow S3 logging service
   - Public Access: Blocked

**Security Features**:
- All buckets have public access blocked (4 settings)
- Encryption at rest (AES256 or KMS with automatic key rotation)
- SSL/TLS encryption in transit (enforced by AWS)
- Bucket policies with least privilege access
- Versioning enabled for uploads bucket
- S3 access logging for audit trail
- CloudWatch monitoring and alarms

**Cost Optimization**:
- Intelligent lifecycle policies with tiered storage
- Automatic transition to Infrequent Access (IA) after 30-90 days
- Automatic transition to Glacier for archival after 90-180 days
- Configurable expiration policies
- Cleanup of incomplete multipart uploads (7 days)
- Noncurrent version expiration (90 days)
- Cost savings: ~49% with lifecycle policies vs STANDARD only

**Storage Lifecycle Example** (Application Uploads):
- Days 0-90: STANDARD ($0.023/GB/month)
- Days 90-180: STANDARD_IA ($0.0125/GB/month) - 46% savings
- Days 180+: GLACIER ($0.004/GB/month) - 83% savings
- Optional: Expiration after X days

**Monitoring**:
- CloudWatch alarm: Bucket size exceeds threshold (default 100GB)
- CloudWatch alarm: High 4xx error rate (> 10 in 5 minutes)
- S3 metrics: BucketSizeBytes, NumberOfObjects, requests, errors, latency
- Access logs for audit trail and security analysis
- Integration with SNS for alarm notifications

**Optional KMS Encryption**:
- Customer-managed KMS key for uploads bucket
- Automatic key rotation enabled
- Key policy allows application role access
- Bucket key enabled for cost optimization

**CORS Configuration** (Application Uploads):
- Configurable allowed origins (default: * for development)
- Allowed methods: GET, PUT, POST, DELETE, HEAD
- Allowed headers: * (configurable)
- Expose headers: ETag
- Max age: 3600 seconds

**Bucket Policies**:
- ALB logs: Allow elasticloadbalancing.amazonaws.com
- CloudTrail logs: Allow cloudtrail.amazonaws.com
- General logs: Allow logging.s3.amazonaws.com
- Uploads bucket: IAM role-based access only

**Key Features**:
- Production-ready configuration with security best practices
- 30+ configurable variables for customization
- Comprehensive lifecycle policies for cost optimization
- CloudWatch monitoring and alarms
- Complete documentation with usage examples
- Support for both AES256 and KMS encryption
- CORS configuration for browser uploads
- Multi-tiered storage for cost efficiency

**Variables** (Key Configurations):
- `use_kms_encryption` - Use KMS instead of AES256 (default: false)
- `enable_versioning` - Enable versioning for uploads (default: true)
- `enable_lifecycle_policies` - Enable lifecycle transitions (default: true)
- `transition_to_ia_days` - Days before IA transition (default: 90)
- `transition_to_glacier_days` - Days before Glacier (default: 180)
- `expire_after_days` - Days before expiration (default: 0/never)
- `alb_logs_retention_days` - ALB log retention (default: 90)
- `cloudtrail_logs_retention_days` - Audit log retention (default: 365)
- `enable_cors` - Enable CORS for uploads (default: true)
- `cors_allowed_origins` - CORS origins (default: ["*"])
- `enable_cloudwatch_alarms` - Enable alarms (default: true)
- `bucket_size_alarm_threshold` - Size alarm threshold (default: 100GB)

**Outputs**:
- Bucket IDs (names) for all 4 buckets
- Bucket ARNs for IAM policies
- Bucket domain names for application configuration
- KMS key ID, ARN, and alias (if KMS encryption enabled)
- Summary object with all bucket details

**Usage**:
```bash
cd infrastructure/s3
terraform init

# Basic deployment (AES256 encryption)
terraform plan \
  -var="project_name=transparent-rfp" \
  -var="environment=production"

# Advanced deployment (KMS encryption, custom lifecycle)
terraform apply \
  -var="project_name=transparent-rfp" \
  -var="environment=production" \
  -var="use_kms_encryption=true" \
  -var="app_role_arn=arn:aws:iam::123456789012:role/app-role" \
  -var="transition_to_ia_days=60" \
  -var="cors_allowed_origins=[\"https://rfp.example.com\"]"
```

**Application Integration**:
```typescript
// lib/s3.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1"
});
const bucketName = process.env.S3_UPLOADS_BUCKET;

export async function uploadFile(file: File, key: string) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: await file.arrayBuffer(),
    ContentType: file.type,
  });

  await s3Client.send(command);
  return `s3://${bucketName}/${key}`;
}
```

**Cost Estimates** (us-east-1):
- Storage (100GB): $2.30/month (STANDARD) → $1.43/month (with lifecycle)
- Requests (1M PUT, 10M GET): ~$10/month
- Data transfer out (10GB): $0.90/month
- KMS (if enabled): $1/month for key + $0.03/10K requests
- Total: ~$13-15/month for moderate usage with significant savings from lifecycle policies

See [infrastructure/s3/README.md](../infrastructure/s3/README.md) for complete documentation including:
- Detailed architecture diagrams
- All configuration variables
- Security best practices
- Cost optimization strategies
- Monitoring and troubleshooting guides
- Application integration examples

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
- [x] Create ElastiCache Redis cluster
- [x] Instance: cache.t3.micro or cache.t4g.micro
- [x] Place in private subnet
- [x] Configure security group (app access only)
- [x] Enable encryption in transit
- [x] Enable automatic backups

#### Option B: Upstash Redis
*Already supported by application, no AWS infrastructure needed*
- [x] Use existing Upstash account
- [x] Store credentials in Secrets Manager
- [x] Configure in application

**Implementation Details**:
- **Location**: `infrastructure/redis/`
- **Terraform Modules**: main.tf, variables.tf, outputs.tf, README.md

**Redis Options**:

| Feature | ElastiCache | Upstash |
|---------|-------------|---------|
| **Complexity** | Medium - VPC setup | Low - No infrastructure |
| **Cost (low traffic)** | ~$23/month (2 nodes) | Free (up to 10K cmd/day) |
| **Latency** | <1ms (same VPC) | 50-200ms (REST API) |
| **VPC Integration** | ✅ Yes | ❌ No (public HTTPS) |
| **Best For** | Production with ECS | Serverless, MVPs |

**ElastiCache Components Created**:
1. **Replication Group** - Primary + replica nodes for high availability
2. **Subnet Group** - Private subnets for Redis placement
3. **Parameter Group** - Redis configuration (maxmemory-policy: allkeys-lru)
4. **Security Group** - Allows access from application security group only
5. **CloudWatch Alarms** - CPU, memory, evictions, swap usage monitoring
6. **Secrets Manager** - Auto-generated auth token for TLS connections

**Key Features**:
- Multi-AZ automatic failover
- Encryption at rest (KMS) and in transit (TLS)
- Auto-generated auth token stored in Secrets Manager
- Daily automatic backups (7-day retention)
- CloudWatch monitoring with 4 pre-configured alarms
- Support for Redis 7.1
- Graviton (t4g) instance types for cost savings

**Cost Estimates** (us-east-1):
- Development (1x cache.t4g.micro): ~$12/month
- Production (2x cache.t4g.micro): ~$23/month
- High availability (2x cache.t4g.small): ~$46/month

**Upstash Alternative**:
- Free tier: 10,000 commands/day
- Pro plan: $10/month for 1M commands
- No infrastructure management required
- Already integrated in application
- Perfect for Amplify deployments

**Usage Example (ElastiCache)**:
```hcl
module "redis" {
  source = "./infrastructure/redis"

  create_elasticache = true
  use_upstash        = false

  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  app_security_group_ids  = [module.ecs.ecs_tasks_security_group_id]

  redis_node_type       = "cache.t4g.micro"
  redis_num_cache_nodes = 2  # Primary + replica

  enable_encryption_at_rest    = true
  enable_encryption_in_transit = true

  snapshot_retention_limit = 7

  environment = "production"
}
```

**Usage Example (Upstash)**:
```hcl
module "redis" {
  source = "./infrastructure/redis"

  create_elasticache = false
  use_upstash        = true

  store_upstash_in_secrets_manager = true
  upstash_redis_url                = var.upstash_url
  upstash_redis_token              = var.upstash_token

  environment = "production"
}
```

**Application Integration**:
The application already supports Upstash Redis for rate limiting. To use ElastiCache, update the Redis client configuration to use ioredis instead of @upstash/redis.

**Monitoring & Alarms**:
- CPU utilization (>75%)
- Memory utilization (>90%)
- Evictions (>1000, indicates memory pressure)
- Swap usage (>50MB, indicates memory issues)

**When to Use ElastiCache**:
- Production apps with ECS/Fargate in VPC
- Sub-millisecond latency requirements
- High throughput caching needs
- Private network access required

**When to Use Upstash**:
- Amplify deployments (no VPC)
- Development and staging environments
- Low to moderate traffic apps
- Serverless architecture
- Want to avoid infrastructure management

See [infrastructure/redis/README.md](../infrastructure/redis/README.md) for complete documentation including:
- Detailed architecture diagrams
- Node type comparison and pricing
- Scaling strategies (vertical and horizontal)
- Backup and recovery procedures
- Comprehensive troubleshooting guide
- Security best practices
- Migration guide (Upstash → ElastiCache)

### Phase 8: Monitoring & Logging (SEC-1058)

**Implementation**: Use `infrastructure/monitoring` module for comprehensive monitoring.

#### Features
- **SNS Topics**: Critical and warning alert channels with email/Slack subscriptions
- **CloudWatch Dashboard**: Unified metrics view for ECS, RDS, Redis, and ALB
- **CloudWatch Alarms**: Application, database, and composite alarms
- **Log Insights Queries**: Pre-configured queries for troubleshooting
- **Cost**: ~$2-5/month

#### Usage

```hcl
module "monitoring" {
  source = "./infrastructure/monitoring"

  # Alert recipients
  critical_alert_emails = ["oncall@example.com", "team@example.com"]
  warning_alert_emails  = ["team@example.com"]

  # Slack webhooks (optional)
  slack_webhook_url_critical = var.slack_webhook_critical
  slack_webhook_url_warning  = var.slack_webhook_warning

  # Resource IDs from other modules
  ecs_cluster_name            = module.ecs.cluster_name
  rds_instance_id             = module.rds.instance_id
  redis_replication_group_id  = module.redis.redis_replication_group_id
  alb_arn_suffix              = module.alb.arn_suffix
  log_group_name              = module.ecs.cloudwatch_log_group_name

  # Alarm thresholds
  error_rate_threshold      = 10    # 5XX errors per 5 minutes
  response_time_threshold   = 2     # seconds
  rds_cpu_threshold         = 80    # percent
  rds_connections_threshold = 80    # connections

  environment = "production"
}
```

#### Included Alarms

**Application**:
- High Error Rate: >10 5XX errors in 5 minutes (critical)
- High Response Time: >2 seconds average for 15 minutes (warning)

**Database**:
- High CPU: >80% for 10 minutes (warning)
- High Connections: >80 connections for 10 minutes (warning)
- Low Storage: <5 GB free space (critical)

**Composite**:
- Service Unhealthy: Multiple metrics in alarm state (critical)

#### Setup Steps

1. **Configure email alerts**:
   ```bash
   # Add emails to terraform.tfvars
   critical_alert_emails = ["oncall@example.com"]
   warning_alert_emails  = ["team@example.com"]
   ```

2. **Apply monitoring module**:
   ```bash
   terraform apply
   ```

3. **Confirm SNS subscriptions**: Check email and click confirmation links

4. **Optional: Configure Slack**:
   - Create incoming webhook in Slack
   - Add webhook URLs to variables
   - Re-apply Terraform

5. **View dashboard**:
   ```
   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=transparent-trust-production
   ```

#### Log Insights Queries

Pre-configured saved queries:
- **Error Logs**: Find all ERROR messages
- **Slow Requests**: Find requests >1 second

Access: CloudWatch → Logs → Insights → Saved queries

### Phase 9: DNS & CDN (SEC-1059)

**Implementation**: Use `infrastructure/dns-cdn` module for DNS and optional CDN.

#### Features
- **Route 53**: DNS management with automated ACM certificate validation
- **ACM Certificates**: Free SSL/TLS certificates with auto-renewal
- **CloudFront CDN**: Optional global content delivery (disabled by default)
- **AWS WAF**: Optional web application firewall for CloudFront
- **Health Checks**: Route 53 health monitoring with CloudWatch alarms
- **Cost**: ~$1/month (DNS only) or $1-5+/month (with CloudFront)

#### Architecture Options

**Option 1: Direct ALB (Recommended)**
```
User → Route 53 → ALB → ECS/Fargate
```
- Simplest setup, lower cost
- Good for single-region applications

**Option 2: CloudFront CDN**
```
User → Route 53 → CloudFront → ALB → ECS/Fargate
```
- Global edge caching, better worldwide performance
- DDoS protection, optional WAF integration

#### Usage - Direct ALB

```hcl
module "dns_cdn" {
  source = "./infrastructure/dns-cdn"

  # Domain configuration
  domain_name         = "transparenttrust.com"
  create_hosted_zone  = false  # Use existing hosted zone
  include_wildcard    = true   # Include *.transparenttrust.com

  # ALB configuration (from ECS module)
  alb_dns_name = module.ecs.alb_dns_name
  alb_zone_id  = module.ecs.alb_zone_id

  # CloudFront disabled (direct to ALB)
  enable_cloudfront = false

  # Health check
  create_health_check       = true
  health_check_path         = "/api/health"
  health_check_alarm_actions = [module.monitoring.critical_alert_topic_arn]

  environment = "production"
}
```

#### Usage - With CloudFront CDN

```hcl
module "dns_cdn" {
  source = "./infrastructure/dns-cdn"

  domain_name         = "transparenttrust.com"
  create_hosted_zone  = false

  # CloudFront enabled
  enable_cloudfront         = true
  origin_domain_name        = module.ecs.alb_dns_name
  cloudfront_price_class    = "PriceClass_100"  # US, Canada, Europe
  enable_static_cache       = true              # Cache _next/static/* aggressively

  # Optional WAF
  enable_waf       = true
  waf_rate_limit   = 2000  # Max 2000 requests per 5 min per IP

  # Caching behavior
  cloudfront_default_ttl = 3600    # 1 hour
  cloudfront_max_ttl     = 86400   # 24 hours

  environment = "production"
}
```

#### Setup Steps

1. **Apply Terraform**:
   ```bash
   cd infrastructure
   terraform apply
   ```

2. **Update Name Servers** (if creating new hosted zone):
   - Get name servers from `terraform output hosted_zone_name_servers`
   - Update at your domain registrar
   - Wait for DNS propagation (24-48 hours)

3. **Verify DNS**:
   ```bash
   dig transparenttrust.com
   dig NS transparenttrust.com
   curl -I https://transparenttrust.com
   ```

4. **Update Application**:
   ```bash
   # Update NEXTAUTH_URL in Secrets Manager or Parameter Store
   NEXTAUTH_URL=https://transparenttrust.com
   ```

5. **Invalidate CloudFront cache** (if using CloudFront):
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id $(terraform output -raw cloudfront_distribution_id) \
     --paths "/*"
   ```

#### CloudFront Price Classes

- **PriceClass_100**: US, Canada, Europe (lowest cost)
- **PriceClass_200**: Above + Asia, South Africa, South America
- **PriceClass_All**: All edge locations (highest performance)

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

**Implementation**: Use `infrastructure/cost-management` module for cost monitoring and optimization.

#### Features
- **AWS Budgets**: Monthly and per-service budgets with multi-threshold alerts
- **Cost Anomaly Detection**: ML-based detection of unusual spending patterns
- **Cost Allocation Tags**: Track costs by project, environment, team
- **Cost Dashboard**: CloudWatch dashboard for billing metrics
- **Automated Reports**: Optional daily/weekly cost reports
- **Cost**: Budgets are free, anomaly detection included in Cost Explorer

#### Components

**AWS Budgets**:
- Monthly total budget with 50%, 80%, 100% alerts
- Forecasted cost alerts (predict overspending)
- Optional per-service budgets (EC2, RDS, S3, etc.)
- Email and SNS notifications

**Cost Anomaly Detection**:
- Service-level anomaly detection using ML
- Daily notifications for unusual spending
- Customizable alert threshold ($10 minimum)
- Root cause analysis

**Cost Allocation Tags**:
- Project, Environment, Team, CostCenter
- Enable chargeback and cost attribution
- Track costs by business unit

#### Usage - Basic Setup

```hcl
module "cost_management" {
  source = "./infrastructure/cost-management"

  # Monthly budget
  enable_monthly_budget = true
  monthly_budget_amount = "200"  # USD
  budget_start_date     = "2024-01-01"

  # Alert thresholds
  budget_alert_threshold_1 = 50   # Alert at $100
  budget_alert_threshold_2 = 80   # Alert at $160
  budget_alert_threshold_3 = 100  # Alert at $200

  # Alert recipients
  budget_alert_emails = [
    "finance@example.com",
    "engineering@example.com"
  ]

  # Anomaly detection
  enable_anomaly_detection    = true
  anomaly_threshold_amount    = 10
  anomaly_alert_email         = "finance@example.com"

  # Cost dashboard
  enable_cost_dashboard = true

  environment = "production"
}
```

#### Setup Steps

1. **Apply Terraform**:
   ```bash
   terraform apply
   ```

2. **Confirm email subscriptions**: Check email and click confirmation links

3. **Enable Cost Explorer** (one-time, manual):
   Visit: https://console.aws.amazon.com/cost-management/home#/dashboard
   Click "Enable Cost Explorer"

4. **Activate cost allocation tags** (manual):
   - Visit: https://console.aws.amazon.com/billing/home#/tags
   - Activate: Project, Environment, Team, CostCenter
   - Wait 24 hours for costs to be tagged

5. **View current costs**:
   ```bash
   aws ce get-cost-and-usage \
     --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) \
     --granularity MONTHLY \
     --metrics BlendedCost
   ```

#### Cost Optimization Strategies

**Compute Savings (up to 72%)**:
- Use Compute Savings Plans after 3-6 months
- Switch to Graviton instances (20% savings)
- Right-size based on CloudWatch metrics
- Use Spot instances for non-critical workloads (90% savings)

**Database Savings (up to 69%)**:
- Use Aurora Serverless for variable workloads
- Consider RDS Reserved Instances
- Use single-AZ for non-production (50% savings)

**Storage Savings (up to 84%)**:
- Use S3 Intelligent-Tiering (automatic optimization)
- Set lifecycle policies to move to Glacier
- Delete unused snapshots and volumes

**Networking Savings (up to $70/month)**:
- Use VPC endpoints instead of NAT Gateway (save $35/month)
- Use single NAT for non-production
- Use CloudFront for static content

#### Estimated Monthly Costs

**Minimal Setup** (~$29-39/month):
- Amplify hosting + builds: $5-15
- RDS db.t3.micro Single-AZ: $15
- S3 50GB: $1.50
- Basic monitoring: $5-8

**Standard Setup** (~$163/month):
- ECS Fargate 1 task: $30
- RDS db.t3.small Multi-AZ: $40
- ALB: $20
- NAT Gateway: $35
- Compliance (CloudTrail, Config, GuardDuty): $21
- Other services: $17

**Optimized Setup** (~$75/month):
- Use Amplify (saves $25)
- Single-AZ RDS in dev (saves $15)
- VPC endpoints instead of NAT (saves $35)
- Upstash instead of ElastiCache (saves $12)

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
