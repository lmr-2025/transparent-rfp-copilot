# S3 Buckets Infrastructure

This Terraform module creates and configures S3 buckets for the Transparent RFP Copilot application, including application file uploads, access logs, and audit logs.

## Table of Contents

- [Overview](#overview)
- [Buckets Created](#buckets-created)
- [Features](#features)
- [Architecture](#architecture)
- [Variables](#variables)
- [Outputs](#outputs)
- [Usage](#usage)
- [Security](#security)
- [Cost Optimization](#cost-optimization)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

This module provisions four S3 buckets with security best practices, lifecycle policies, and monitoring:

1. **Application Uploads Bucket** - Stores user-uploaded files (PDFs, CSVs, Excel, Word, PPT)
2. **ALB Access Logs Bucket** - Stores Application Load Balancer access logs
3. **CloudTrail Logs Bucket** - Stores AWS CloudTrail audit logs
4. **General Logs Bucket** - Stores S3 access logs and other application logs

All buckets are configured with:
- Encryption at rest (AES256 or KMS)
- Public access blocking
- Lifecycle policies for cost optimization
- CloudWatch monitoring and alarms

## Buckets Created

### 1. Application Uploads Bucket
**Purpose**: Store user-uploaded documents for RFP analysis

**Features**:
- Versioning enabled (configurable)
- AES256 or KMS encryption
- CORS configuration for web uploads
- Lifecycle transitions to reduce costs
- S3 access logging

**Typical Objects**:
- PDF files
- CSV files
- Excel spreadsheets
- Word documents
- PowerPoint presentations

### 2. ALB Access Logs Bucket
**Purpose**: Store Application Load Balancer access logs for debugging and security analysis

**Features**:
- AES256 encryption
- Lifecycle policy: 30 days → IA, 90 days → Glacier, expire after configurable period
- Bucket policy allowing ALB service to write logs

**Log Format**: ELB access log format

### 3. CloudTrail Logs Bucket
**Purpose**: Store AWS CloudTrail audit logs for compliance

**Features**:
- AES256 encryption
- Lifecycle policy: 90 days → IA, 180 days → Glacier, expire after 365 days (configurable)
- Bucket policy allowing CloudTrail service to write logs

**Compliance**: Supports SOC 2, HIPAA, PCI DSS audit requirements

### 4. General Logs Bucket
**Purpose**: Store S3 access logs and other miscellaneous logs

**Features**:
- AES256 encryption
- Lifecycle policy for cost management
- Bucket policy allowing S3 service to write access logs

## Features

### Security
- ✅ All buckets have public access blocked
- ✅ Encryption at rest (AES256 or KMS)
- ✅ SSL/TLS encryption in transit (enforced by AWS)
- ✅ Bucket policies with least privilege access
- ✅ Versioning for data protection (uploads bucket)
- ✅ S3 access logging enabled
- ✅ CloudWatch monitoring and alarms

### Cost Optimization
- ✅ Intelligent lifecycle policies
- ✅ Transition to Infrequent Access storage class
- ✅ Transition to Glacier for long-term archival
- ✅ Automatic expiration of old objects
- ✅ Cleanup of incomplete multipart uploads
- ✅ Noncurrent version expiration

### Reliability
- ✅ S3 Standard storage (99.99% availability)
- ✅ Versioning for uploads bucket
- ✅ Cross-region replication ready (optional)
- ✅ MFA delete ready (optional)

### Monitoring
- ✅ CloudWatch alarms for bucket size
- ✅ CloudWatch alarms for 4xx errors
- ✅ S3 access logging for audit trail
- ✅ Integration with CloudWatch Logs

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer (ECS/Fargate)                        │
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │  Next.js App │──────▶│  IAM Role    │                │
│  └──────────────┘      └──────┬───────┘                │
└────────────────────────────────│──────────────────────┘
                                  │
                                  │ S3 API Calls
                                  ▼
┌─────────────────────────────────────────────────────────┐
│  S3 Buckets                                             │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  App Uploads Bucket                          │      │
│  │  - User files (PDF, CSV, Excel, etc.)        │      │
│  │  - Versioning enabled                        │      │
│  │  - KMS/AES256 encryption                     │      │
│  │  - CORS enabled                              │      │
│  │  - Lifecycle: 90d→IA, 180d→Glacier          │      │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  ALB Logs Bucket                             │      │
│  │  - Load balancer access logs                 │      │
│  │  - Lifecycle: 30d→IA, 90d→Glacier, 90d expire│     │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  CloudTrail Logs Bucket                      │      │
│  │  - AWS API audit logs                        │      │
│  │  - Lifecycle: 90d→IA, 180d→Glacier, 365d exp │     │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  General Logs Bucket                         │      │
│  │  - S3 access logs                            │      │
│  │  - Application logs                          │      │
│  │  - Lifecycle: 30d→IA, 90d→Glacier, 90d expire│     │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                                  │
                                  │ Metrics & Logs
                                  ▼
┌─────────────────────────────────────────────────────────┐
│  CloudWatch                                             │
│  - Bucket size alarms                                   │
│  - 4xx error alarms                                     │
│  - Access logs                                          │
└─────────────────────────────────────────────────────────┘
```

## Variables

### Required Variables

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `project_name` | Project name for resource naming | `string` | `"transparent-rfp"` |
| `environment` | Environment name | `string` | `"production"` |

### Optional Variables

#### Encryption

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `use_kms_encryption` | Use KMS instead of AES256 for uploads bucket | `bool` | `false` |
| `kms_deletion_window_days` | KMS key deletion window | `number` | `30` |
| `app_role_arn` | Application IAM role ARN for KMS access | `string` | `""` |

#### Versioning

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_versioning` | Enable versioning for uploads bucket | `bool` | `true` |
| `noncurrent_version_expiration_days` | Days before expiring old versions | `number` | `90` |

#### Lifecycle Policies

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_lifecycle_policies` | Enable lifecycle policies | `bool` | `true` |
| `transition_to_ia_days` | Days before moving to Infrequent Access | `number` | `90` |
| `transition_to_glacier_days` | Days before moving to Glacier | `number` | `180` |
| `expire_after_days` | Days before object expiration (0=never) | `number` | `0` |
| `alb_logs_retention_days` | ALB logs retention period | `number` | `90` |
| `cloudtrail_logs_retention_days` | CloudTrail logs retention | `number` | `365` |
| `general_logs_retention_days` | General logs retention | `number` | `90` |

#### CORS

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_cors` | Enable CORS for uploads bucket | `bool` | `true` |
| `cors_allowed_origins` | Allowed origins for CORS | `list(string)` | `["*"]` |
| `cors_allowed_methods` | Allowed HTTP methods | `list(string)` | `["GET","PUT","POST","DELETE","HEAD"]` |
| `cors_allowed_headers` | Allowed headers | `list(string)` | `["*"]` |

#### Monitoring

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_cloudwatch_alarms` | Enable CloudWatch alarms | `bool` | `true` |
| `bucket_size_alarm_threshold` | Bucket size alarm threshold (bytes) | `number` | `107374182400` (100GB) |
| `alarm_sns_topic_arn` | SNS topic for alarm notifications | `string` | `""` |
| `enable_access_logging` | Enable S3 access logging | `bool` | `true` |

#### Tags

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `tags` | Additional tags for all resources | `map(string)` | `{}` |

## Outputs

| Output | Description |
|--------|-------------|
| `app_uploads_bucket_id` | Application uploads bucket name |
| `app_uploads_bucket_arn` | Application uploads bucket ARN |
| `app_uploads_bucket_domain_name` | Application uploads bucket domain |
| `app_uploads_bucket_regional_domain_name` | Regional domain name |
| `alb_logs_bucket_id` | ALB logs bucket name |
| `alb_logs_bucket_arn` | ALB logs bucket ARN |
| `cloudtrail_logs_bucket_id` | CloudTrail logs bucket name |
| `cloudtrail_logs_bucket_arn` | CloudTrail logs bucket ARN |
| `logs_bucket_id` | General logs bucket name |
| `logs_bucket_arn` | General logs bucket ARN |
| `kms_key_id` | KMS key ID (if enabled) |
| `kms_key_arn` | KMS key ARN (if enabled) |
| `kms_key_alias` | KMS key alias (if enabled) |
| `buckets_summary` | Summary of all buckets |

## Usage

### Basic Usage (AES256 Encryption)

```hcl
module "s3_buckets" {
  source = "./infrastructure/s3"

  project_name = "transparent-rfp"
  environment  = "production"

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### Advanced Usage (KMS Encryption, Custom Lifecycle)

```hcl
module "s3_buckets" {
  source = "./infrastructure/s3"

  project_name = "transparent-rfp"
  environment  = "production"

  # Encryption
  use_kms_encryption = true
  app_role_arn       = "arn:aws:iam::123456789012:role/transparent-rfp-app-role-production"

  # Lifecycle policies
  transition_to_ia_days       = 60  # Move to IA after 60 days
  transition_to_glacier_days  = 120 # Move to Glacier after 120 days
  expire_after_days           = 0   # Never expire

  # Log retention
  alb_logs_retention_days       = 30  # Keep ALB logs for 30 days
  cloudtrail_logs_retention_days = 365 # Keep audit logs for 1 year
  general_logs_retention_days   = 60  # Keep general logs for 60 days

  # CORS (restrict to production domain)
  cors_allowed_origins = ["https://rfp.example.com"]
  cors_allowed_methods = ["GET", "PUT", "POST"]
  cors_allowed_headers = ["Content-Type", "x-amz-*"]

  # Monitoring
  enable_cloudwatch_alarms     = true
  bucket_size_alarm_threshold  = 536870912000 # 500 GB
  alarm_sns_topic_arn          = "arn:aws:sns:us-east-1:123456789012:alerts"

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
    Team      = "Security"
  }
}
```

### Deploy

```bash
cd infrastructure/s3

# Initialize Terraform
terraform init

# Review plan
terraform plan \
  -var="project_name=transparent-rfp" \
  -var="environment=production"

# Apply configuration
terraform apply \
  -var="project_name=transparent-rfp" \
  -var="environment=production"

# View outputs
terraform output
```

### Using with Application

After deploying, reference the bucket names in your application:

```bash
# Get bucket name
BUCKET_NAME=$(terraform output -raw app_uploads_bucket_id)

# Set environment variable for application
export S3_UPLOADS_BUCKET=$BUCKET_NAME
```

**Next.js application code**:

```typescript
// lib/s3.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
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

## Security

### Encryption

**At Rest**:
- **AES256** (default): Server-side encryption with S3-managed keys
- **KMS** (optional): Customer-managed encryption with automatic key rotation

```bash
# Verify encryption
aws s3api get-bucket-encryption \
  --bucket transparent-rfp-uploads-production
```

**In Transit**:
- All S3 API calls use HTTPS/TLS
- Enforced by AWS (cannot be disabled)

### Access Control

**Public Access Blocking**:
```bash
# Verify public access is blocked
aws s3api get-public-access-block \
  --bucket transparent-rfp-uploads-production
```

Expected output:
```json
{
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }
}
```

**Bucket Policies**:
- ALB logs bucket: Allow only ELB service
- CloudTrail logs bucket: Allow only CloudTrail service
- General logs bucket: Allow only S3 logging service
- Uploads bucket: Access via IAM role only

### IAM Policy for Application

Add this to your application's IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::transparent-rfp-uploads-production",
        "arn:aws:s3:::transparent-rfp-uploads-production/*"
      ]
    }
  ]
}
```

### Versioning & MFA Delete

**Enable versioning**:
```bash
aws s3api put-bucket-versioning \
  --bucket transparent-rfp-uploads-production \
  --versioning-configuration Status=Enabled
```

**Enable MFA delete** (optional, for extra protection):
```bash
aws s3api put-bucket-versioning \
  --bucket transparent-rfp-uploads-production \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::123456789012:mfa/root-account-mfa-device 123456"
```

## Cost Optimization

### Lifecycle Policies

The module implements intelligent lifecycle policies to minimize storage costs:

**Application Uploads Bucket**:
1. **Day 0-90**: STANDARD storage (~$0.023/GB)
2. **Day 90-180**: STANDARD_IA storage (~$0.0125/GB) - 46% savings
3. **Day 180+**: GLACIER storage (~$0.004/GB) - 83% savings
4. **Optional**: Expiration after X days

**Cost Example** (1TB of files over 1 year):
- Without lifecycle: $282/year (all STANDARD)
- With lifecycle: $143/year (49% savings)
- With expiration: Even lower

### Storage Classes Comparison

| Storage Class | Use Case | Cost/GB/month | Retrieval Cost |
|---------------|----------|---------------|----------------|
| STANDARD | Frequent access (< 90 days) | $0.023 | Free |
| STANDARD_IA | Infrequent access (90-180 days) | $0.0125 | $0.01/GB |
| GLACIER | Archival (180+ days) | $0.004 | $0.02/GB + time |
| INTELLIGENT_TIERING | Automatic optimization | $0.023 + $0.0025/1000 objects | Free |

### Monitor Costs

```bash
# View storage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=transparent-rfp-uploads-production \
              Name=StorageType,Value=StandardStorage \
  --start-time $(date -u -d '7 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 86400 \
  --statistics Average

# View number of objects
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name NumberOfObjects \
  --dimensions Name=BucketName,Value=transparent-rfp-uploads-production \
              Name=StorageType,Value=AllStorageTypes \
  --start-time $(date -u -d '7 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 86400 \
  --statistics Average
```

### Cost Optimization Tips

1. **Enable lifecycle policies** - Automatically transition to cheaper storage
2. **Set expiration dates** - Delete files after they're no longer needed
3. **Clean up incomplete uploads** - Already configured (7 days)
4. **Delete old versions** - Noncurrent versions expire after 90 days
5. **Use intelligent tiering** - For unpredictable access patterns (not implemented, can be added)
6. **Monitor regularly** - Set CloudWatch alarms for unexpected growth

## Monitoring

### CloudWatch Metrics

**Key Metrics**:
- `BucketSizeBytes` - Total bucket size
- `NumberOfObjects` - Total object count
- `AllRequests` - All S3 requests
- `GetRequests` - GET request count
- `PutRequests` - PUT request count
- `4xxErrors` - Client errors
- `5xxErrors` - Server errors
- `FirstByteLatency` - Time to first byte
- `TotalRequestLatency` - Total request time

### CloudWatch Alarms

The module creates alarms for:

1. **Bucket Size Alarm** - Alert when bucket exceeds threshold (default 100GB)
2. **4xx Errors Alarm** - Alert when too many client errors occur

**View alarm status**:
```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix transparent-rfp
```

### S3 Access Logs

Access logs are stored in the general logs bucket:

```bash
# View recent access logs
aws s3 ls s3://transparent-rfp-logs-production/app-uploads-access-logs/ \
  --recursive \
  --human-readable \
  | tail -20

# Download and analyze logs
aws s3 cp s3://transparent-rfp-logs-production/app-uploads-access-logs/ . \
  --recursive

# Parse logs (example: count requests by IP)
cat *.log | awk '{print $4}' | sort | uniq -c | sort -rn | head -10
```

### CloudWatch Logs Insights

Create a log group for S3 data events (requires CloudTrail):

```bash
# Query S3 operations
aws logs start-query \
  --log-group-name /aws/cloudtrail \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, eventName, requestParameters.bucketName, requestParameters.key
    | filter eventSource = "s3.amazonaws.com"
    | filter requestParameters.bucketName = "transparent-rfp-uploads-production"
    | stats count() by eventName'
```

## Troubleshooting

### Access Denied Errors

**Symptom**: Application cannot upload/download files

**Check 1: IAM permissions**
```bash
# Verify application role has S3 permissions
aws iam get-role-policy \
  --role-name transparent-rfp-app-role-production \
  --policy-name S3Access

# Test access with assume role
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/transparent-rfp-app-role-production \
  --role-session-name test

# Use temporary credentials to test S3 access
aws s3 ls s3://transparent-rfp-uploads-production/ \
  --profile assumed-role
```

**Check 2: Bucket policy**
```bash
# View bucket policy
aws s3api get-bucket-policy \
  --bucket transparent-rfp-uploads-production \
  --query Policy --output text | jq .
```

**Check 3: KMS permissions** (if using KMS)
```bash
# Verify role can use KMS key
aws kms describe-key --key-id <key-id>
aws kms get-key-policy --key-id <key-id> --policy-name default
```

### CORS Errors

**Symptom**: Browser console shows CORS errors

**Check CORS configuration**:
```bash
aws s3api get-bucket-cors \
  --bucket transparent-rfp-uploads-production
```

**Update CORS** (if needed):
```bash
aws s3api put-bucket-cors \
  --bucket transparent-rfp-uploads-production \
  --cors-configuration file://cors.json
```

**cors.json**:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://rfp.example.com"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### High Storage Costs

**Symptom**: S3 bill is higher than expected

**Check storage breakdown**:
```bash
# Get storage by storage class
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=transparent-rfp-uploads-production \
              Name=StorageType,Value=StandardStorage \
  --start-time $(date -u -d '30 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 2592000 \
  --statistics Average
```

**Check incomplete multipart uploads**:
```bash
aws s3api list-multipart-uploads \
  --bucket transparent-rfp-uploads-production
```

**Solutions**:
1. Verify lifecycle policies are active
2. Clean up old versions
3. Abort incomplete uploads
4. Set expiration policy if appropriate

### Slow Upload/Download Performance

**Symptom**: Slow S3 operations

**Check 1: Transfer Acceleration** (optional, costs extra):
```bash
aws s3api put-bucket-accelerate-configuration \
  --bucket transparent-rfp-uploads-production \
  --accelerate-configuration Status=Enabled
```

**Check 2: Use S3 Transfer Acceleration endpoint**:
```typescript
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "https://transparent-rfp-uploads-production.s3-accelerate.amazonaws.com"
});
```

**Check 3: Multipart uploads** (for large files):
```typescript
import { Upload } from "@aws-sdk/lib-storage";

const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: bucketName,
    Key: key,
    Body: file,
  },
  partSize: 10 * 1024 * 1024, // 10 MB parts
  queueSize: 4, // 4 concurrent parts
});

await upload.done();
```

---

**Module Version**: 1.0
**Last Updated**: 2025-12-18
**Terraform Version**: >= 1.0
**AWS Provider Version**: ~> 5.0
