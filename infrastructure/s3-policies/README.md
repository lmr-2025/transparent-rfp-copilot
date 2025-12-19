# S3 Access Policies Module

This Terraform module creates IAM policies and bucket policies for secure S3 access control with least privilege principles.

## Table of Contents

- [Overview](#overview)
- [Policies Created](#policies-created)
- [Features](#features)
- [Variables](#variables)
- [Outputs](#outputs)
- [Usage](#usage)
- [Signed URLs](#signed-urls)
- [Cross-Region Replication](#cross-region-replication)
- [S3 Access Points](#s3-access-points)
- [Security Best Practices](#security-best-practices)
- [Examples](#examples)

## Overview

This module provides comprehensive IAM and bucket policies for S3 access control:

- **Application Access Policy** - Full S3 access for the application
- **Read-Only Policy** - Read-only access for analytics/reporting
- **Lambda Policy** - S3 access for Lambda functions
- **Replication Policy** - Cross-region replication setup
- **Bucket Policies** - Resource-based policies (SSL enforcement, encryption)
- **S3 Access Points** - Advanced access control (optional)

All policies follow AWS security best practices and implement least privilege access.

## Policies Created

### 1. Application S3 Access Policy

**Purpose**: Allow application to perform CRUD operations on S3 buckets

**Permissions**:
- `s3:PutObject` - Upload files
- `s3:GetObject` - Download files
- `s3:DeleteObject` - Delete files
- `s3:ListBucket` - List bucket contents
- `s3:GetObjectVersion` - Access versioned objects
- `s3:DeleteObjectVersion` - Delete specific versions
- `kms:Decrypt`, `kms:GenerateDataKey` - KMS operations (if KMS enabled)

**Conditions**:
- Enforce encryption on uploads
- Scope to specific bucket only

### 2. Read-Only S3 Access Policy

**Purpose**: Provide read-only access for analytics, reporting, and auditing

**Permissions**:
- `s3:GetObject` - Download files
- `s3:GetObjectVersion` - Access versions
- `s3:ListBucket` - List contents
- `s3:GetBucketLocation` - Get bucket location
- `s3:GetBucketVersioning` - Get versioning status
- `kms:Decrypt` - Decrypt objects (if KMS enabled)

**Use Cases**:
- Business intelligence tools
- Reporting systems
- Audit log analysis
- Data science workflows

### 3. Lambda S3 Access Policy

**Purpose**: Allow Lambda functions to process S3 objects

**Permissions**:
- `s3:GetObject` - Read files for processing
- `s3:PutObject` - Write processed files
- `s3:ListBucket` - List bucket contents
- `kms:Decrypt`, `kms:GenerateDataKey` - KMS operations (if KMS enabled)

**Use Cases**:
- File format conversion
- Image/PDF thumbnail generation
- Document text extraction
- Virus scanning
- Data validation

### 4. S3 Replication Policy

**Purpose**: Enable cross-region replication for disaster recovery

**Permissions**:
- Source bucket: Read replication config, get objects and versions
- Destination bucket: Write replicated objects
- KMS: Decrypt from source, encrypt to destination

**Use Cases**:
- Disaster recovery
- Compliance (data residency)
- Latency reduction (multi-region)
- Data sovereignty requirements

### 5. Bucket Policies (Resource-Based)

**Enforcements**:
1. **SSL/TLS Only**: Deny all requests without `aws:SecureTransport`
2. **Encryption Enforcement**: Deny PutObject without proper encryption
3. **Application Role Access**: Explicitly allow application role

**Security Benefits**:
- Defense in depth (identity + resource policies)
- Prevent accidental misconfiguration
- Compliance requirements
- Audit trail

## Features

### Security
- ✅ Least privilege access (only necessary permissions)
- ✅ Encryption enforcement (AES256 or KMS)
- ✅ SSL/TLS requirement (deny unencrypted traffic)
- ✅ Scoped resource access (specific buckets only)
- ✅ Version-aware policies
- ✅ KMS integration
- ✅ Condition-based access control

### Flexibility
- ✅ Modular policy creation (enable/disable each policy)
- ✅ Support for both AES256 and KMS encryption
- ✅ Optional S3 Access Points
- ✅ Optional cross-region replication
- ✅ VPC-restricted access (via Access Points)
- ✅ Multiple policy types for different use cases

### Operations
- ✅ Automatic policy attachment to application role
- ✅ Replication role with AssumeRole policy
- ✅ Access Point with dedicated policy
- ✅ Resource tagging for cost allocation

## Variables

### Required Variables

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `project_name` | Project name for resource naming | `string` | `"transparent-rfp"` |
| `environment` | Environment name | `string` | `"production"` |
| `app_uploads_bucket_id` | Application uploads bucket ID | `string` | `"transparent-rfp-uploads-production"` |
| `app_uploads_bucket_arn` | Application uploads bucket ARN | `string` | `"arn:aws:s3:::bucket-name"` |

### Optional Variables

#### Application Configuration

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `app_role_name` | Application IAM role name | `string` | `""` |
| `app_role_arn` | Application IAM role ARN | `string` | `""` |

#### Encryption

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `use_kms_encryption` | Use KMS encryption | `bool` | `false` |
| `kms_key_arn` | KMS key ARN | `string` | `""` |

#### Policy Flags

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `create_readonly_policy` | Create read-only policy | `bool` | `true` |
| `create_lambda_policy` | Create Lambda policy | `bool` | `false` |
| `create_bucket_policies` | Create bucket policies | `bool` | `true` |
| `create_access_point` | Create S3 Access Point | `bool` | `false` |

#### Replication

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_replication` | Enable replication | `bool` | `false` |
| `replication_destination_bucket_arn` | Destination bucket ARN | `string` | `""` |
| `replication_destination_kms_key_arn` | Destination KMS key ARN | `string` | `""` |

#### Access Point

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `access_point_vpc_id` | VPC ID for Access Point | `string` | `""` |

## Outputs

| Output | Description |
|--------|-------------|
| `app_s3_access_policy_arn` | Application S3 access policy ARN |
| `s3_readonly_policy_arn` | Read-only policy ARN |
| `lambda_s3_policy_arn` | Lambda policy ARN |
| `s3_replication_policy_arn` | Replication policy ARN |
| `s3_replication_role_arn` | Replication role ARN |
| `access_point_arn` | S3 Access Point ARN |
| `access_point_alias` | S3 Access Point alias |
| `policies_summary` | Summary of all policies |

## Usage

### Basic Usage

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "transparent-rfp"
  environment  = "production"

  # Bucket information from s3 module
  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  # Application role
  app_role_name = module.iam.app_runtime_role_name
  app_role_arn  = module.iam.app_runtime_role_arn

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With KMS Encryption

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "transparent-rfp"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = module.iam.app_runtime_role_name
  app_role_arn  = module.iam.app_runtime_role_arn

  # KMS encryption
  use_kms_encryption = true
  kms_key_arn        = module.s3_buckets.kms_key_arn

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With Lambda and Read-Only Policies

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "transparent-rfp"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = module.iam.app_runtime_role_name
  app_role_arn  = module.iam.app_runtime_role_arn

  # Enable additional policies
  create_readonly_policy = true  # For analytics
  create_lambda_policy   = true  # For Lambda file processing

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With Cross-Region Replication

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "transparent-rfp"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = module.iam.app_runtime_role_name
  app_role_arn  = module.iam.app_runtime_role_arn

  # Replication setup
  enable_replication                  = true
  replication_destination_bucket_arn  = "arn:aws:s3:::backup-bucket-us-west-2"
  replication_destination_kms_key_arn = "arn:aws:kms:us-west-2:123456789012:key/xxx"

  use_kms_encryption = true
  kms_key_arn        = module.s3_buckets.kms_key_arn

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With S3 Access Point

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "transparent-rfp"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = module.iam.app_runtime_role_name
  app_role_arn  = module.iam.app_runtime_role_arn

  # S3 Access Point with VPC restriction
  create_access_point = true
  access_point_vpc_id = module.vpc.vpc_id  # Restrict to VPC only

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

## Signed URLs

### What are Signed URLs?

Signed URLs (presigned URLs) provide temporary, secure access to S3 objects without requiring AWS credentials. Perfect for:
- Secure file uploads from browser
- Time-limited download links
- Sharing files with external users
- Avoiding credential exposure

### Generating Signed URLs (Node.js/TypeScript)

```typescript
// lib/s3-signed-urls.ts
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const bucketName = process.env.S3_UPLOADS_BUCKET;

/**
 * Generate presigned URL for uploading a file
 * @param key - S3 object key (file path)
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns Presigned URL for PUT operation
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    // Enforce encryption
    ServerSideEncryption: "AES256", // or "aws:kms" if using KMS
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

/**
 * Generate presigned URL for downloading a file
 * @param key - S3 object key (file path)
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns Presigned URL for GET operation
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}
```

### API Route Example (Next.js)

```typescript
// app/api/uploads/presign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateUploadUrl } from "@/lib/s3-signed-urls";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Authenticate user
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { fileName, fileType } = body;

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  if (!allowedTypes.includes(fileType)) {
    return NextResponse.json(
      { error: "File type not allowed" },
      { status: 400 }
    );
  }

  // Generate unique key
  const key = `uploads/${session.user.id}/${Date.now()}-${fileName}`;

  // Generate presigned URL (valid for 15 minutes)
  const uploadUrl = await generateUploadUrl(key, fileType, 900);

  return NextResponse.json({
    uploadUrl,
    key,
    expiresIn: 900,
  });
}
```

### Frontend Upload Example (React)

```typescript
// components/FileUploader.tsx
"use client";

import { useState } from "react";

export function FileUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Get presigned URL from API
      const response = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, key } = await response.json();

      // 2. Upload file directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      // 3. Save file metadata in database
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      });

      setProgress(100);
      alert("File uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        disabled={uploading}
      />
      {uploading && <div>Uploading... {progress}%</div>}
    </div>
  );
}
```

### Security Considerations for Signed URLs

1. **Short Expiration**: Keep expiration times short (5-15 minutes for uploads, 1 hour for downloads)
2. **Validate File Types**: Only generate URLs for allowed file types
3. **User Authentication**: Require authentication before generating URLs
4. **Rate Limiting**: Limit number of URLs per user per time period
5. **Key Uniqueness**: Use UUID or timestamp to prevent key collisions
6. **Logging**: Log all presigned URL generation for audit trail

## Cross-Region Replication

### When to Use Replication

- **Disaster Recovery**: Protect against regional failures
- **Compliance**: Meet data residency requirements
- **Performance**: Reduce latency for global users
- **Data Sovereignty**: Keep data copies in specific regions

### Setting Up Replication

**1. Enable versioning on source bucket** (required):

```bash
aws s3api put-bucket-versioning \
  --bucket transparent-rfp-uploads-production \
  --versioning-configuration Status=Enabled
```

**2. Create destination bucket in another region**:

```bash
aws s3api create-bucket \
  --bucket transparent-rfp-uploads-backup-us-west-2 \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2
```

**3. Enable versioning on destination bucket**:

```bash
aws s3api put-bucket-versioning \
  --bucket transparent-rfp-uploads-backup-us-west-2 \
  --region us-west-2 \
  --versioning-configuration Status=Enabled
```

**4. Deploy this module with replication enabled**:

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  # ... other variables ...

  enable_replication                  = true
  replication_destination_bucket_arn  = "arn:aws:s3:::transparent-rfp-uploads-backup-us-west-2"
  replication_destination_kms_key_arn = aws_kms_key.destination_key.arn
}
```

**5. Configure replication on source bucket**:

```bash
aws s3api put-bucket-replication \
  --bucket transparent-rfp-uploads-production \
  --replication-configuration file://replication.json
```

**replication.json**:
```json
{
  "Role": "<replication-role-arn-from-terraform-output>",
  "Rules": [
    {
      "Status": "Enabled",
      "Priority": 1,
      "DeleteMarkerReplication": { "Status": "Enabled" },
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::transparent-rfp-uploads-backup-us-west-2",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": { "Minutes": 15 }
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": { "Minutes": 15 }
        },
        "EncryptionConfiguration": {
          "ReplicaKmsKeyID": "<destination-kms-key-arn>"
        }
      }
    }
  ]
}
```

**6. Monitor replication**:

```bash
# Check replication status
aws s3api get-bucket-replication \
  --bucket transparent-rfp-uploads-production

# View replication metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=transparent-rfp-uploads-production \
  --start-time $(date -u -d '1 day ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 3600 \
  --statistics Average,Maximum
```

## S3 Access Points

### What are S3 Access Points?

S3 Access Points simplify data access management for shared datasets. Each Access Point has:
- Unique hostname
- Dedicated access policy
- Optional VPC restriction
- Separate permissions from bucket policy

### Benefits

- **Simplified Management**: One policy per access point vs complex bucket policy
- **Network Isolation**: VPC-only access for sensitive data
- **Application-Specific Access**: Different access points for different apps
- **Audit Trail**: Track access by access point

### Using Access Points

**Access Point ARN Format**:
```
arn:aws:s3:region:account:accesspoint/access-point-name
```

**Access Point Alias** (simpler format):
```
access-point-name-accountid.s3-accesspoint.region.amazonaws.com
```

**Application Code**:

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: "us-east-1" });

// Using Access Point ARN
const command = new GetObjectCommand({
  Bucket: "arn:aws:s3:us-east-1:123456789012:accesspoint/transparent-rfp-uploads-ap-production",
  Key: "uploads/file.pdf",
});

// Or using Access Point alias
const command2 = new GetObjectCommand({
  Bucket: "transparent-rfp-uploads-ap-production-123456789012.s3-accesspoint.us-east-1.amazonaws.com",
  Key: "uploads/file.pdf",
});

const response = await s3Client.send(command);
```

## Security Best Practices

### 1. Least Privilege Access

✅ Only grant permissions that are absolutely necessary
✅ Use separate policies for different use cases (app, read-only, Lambda)
✅ Scope permissions to specific buckets and paths
✅ Use conditions to enforce security requirements

### 2. Encryption

✅ Enforce encryption at rest (AES256 or KMS)
✅ Enforce SSL/TLS for all connections
✅ Use KMS for sensitive data
✅ Enable automatic key rotation

### 3. Access Control

✅ Use both IAM policies (identity-based) and bucket policies (resource-based)
✅ Block all public access
✅ Use S3 Access Points for complex access patterns
✅ Implement VPC endpoints for private access

### 4. Monitoring & Auditing

✅ Enable S3 access logging
✅ Enable CloudTrail for S3 data events
✅ Set up CloudWatch alarms for suspicious activity
✅ Review IAM Access Analyzer findings

### 5. Data Protection

✅ Enable versioning for data recovery
✅ Configure lifecycle policies to manage costs
✅ Use cross-region replication for disaster recovery
✅ Implement MFA delete for critical buckets

## Examples

### Example 1: Basic Application Setup

```hcl
# Create S3 buckets
module "s3_buckets" {
  source = "./infrastructure/s3"

  project_name = "my-app"
  environment  = "production"
}

# Create S3 policies
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "my-app"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = "my-app-role"
  app_role_arn  = "arn:aws:iam::123456789012:role/my-app-role"
}
```

### Example 2: With KMS and Lambda

```hcl
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "my-app"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets.app_uploads_bucket_arn

  app_role_name = "my-app-role"
  app_role_arn  = "arn:aws:iam::123456789012:role/my-app-role"

  use_kms_encryption   = true
  kms_key_arn          = module.s3_buckets.kms_key_arn
  create_lambda_policy = true
}

# Attach Lambda policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_s3_attachment" {
  role       = aws_iam_role.file_processor_lambda.name
  policy_arn = module.s3_policies.lambda_s3_policy_arn
}
```

### Example 3: Complete Setup with Replication

```hcl
# Primary region S3 setup
module "s3_buckets_primary" {
  source = "./infrastructure/s3"

  project_name       = "my-app"
  environment        = "production"
  enable_versioning  = true
  use_kms_encryption = true
}

# Backup region S3 bucket
resource "aws_s3_bucket" "backup" {
  provider = aws.us-west-2
  bucket   = "my-app-uploads-backup-us-west-2"
}

resource "aws_s3_bucket_versioning" "backup" {
  provider = aws.us-west-2
  bucket   = aws_s3_bucket.backup.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 policies with replication
module "s3_policies" {
  source = "./infrastructure/s3-policies"

  project_name = "my-app"
  environment  = "production"

  app_uploads_bucket_id  = module.s3_buckets_primary.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3_buckets_primary.app_uploads_bucket_arn

  app_role_name = "my-app-role"
  app_role_arn  = "arn:aws:iam::123456789012:role/my-app-role"

  use_kms_encryption = true
  kms_key_arn        = module.s3_buckets_primary.kms_key_arn

  enable_replication                  = true
  replication_destination_bucket_arn  = aws_s3_bucket.backup.arn
  replication_destination_kms_key_arn = aws_kms_key.backup_key.arn
}
```

---

**Module Version**: 1.0
**Last Updated**: 2025-12-18
**Terraform Version**: >= 1.0
**AWS Provider Version**: ~> 5.0
