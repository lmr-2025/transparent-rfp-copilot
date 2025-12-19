# AWS Secrets Manager Module

This Terraform module creates and manages application secrets using AWS Secrets Manager with automatic rotation support.

## Table of Contents

- [Overview](#overview)
- [Secrets Created](#secrets-created)
- [Features](#features)
- [Variables](#variables)
- [Outputs](#outputs)
- [Usage](#usage)
- [Accessing Secrets](#accessing-secrets)
- [Automatic Rotation](#automatic-rotation)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This module provisions AWS Secrets Manager secrets for the Transparent RFP Copilot application:

- **NextAuth Secret** - Session encryption for NextAuth.js
- **Anthropic API Key** - Claude API access
- **Google OAuth Credentials** - Google authentication
- **Upstash Redis Credentials** - Rate limiting (optional)
- **Application Encryption Key** - Settings encryption
- **Custom Secrets** - Additional application secrets
- **RDS Database Secret** - Database credentials (imported from RDS module)

All secrets include:
- Automatic encryption with AWS KMS
- IAM access policies
- Recovery window for accidental deletion
- Optional automatic rotation
- CloudWatch monitoring

## Secrets Created

### 1. NextAuth Secret

**Purpose**: Encrypt NextAuth.js sessions and JWT tokens

**Auto-generated**: Yes (32-character random password)

**Format**: String

**Environment Variable**: `NEXTAUTH_SECRET`

**Required**: Yes

### 2. Anthropic API Key

**Purpose**: Authenticate with Claude API

**Auto-generated**: No (must be provided)

**Format**: String (`sk-ant-...`)

**Environment Variable**: `ANTHROPIC_API_KEY`

**Required**: Yes

### 3. Google OAuth Credentials

**Purpose**: Google Sign-In authentication

**Auto-generated**: No (from Google Cloud Console)

**Format**: JSON
```json
{
  "client_id": "xxx.apps.googleusercontent.com",
  "client_secret": "GOCSPX-..."
}
```

**Environment Variables**: 
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Required**: Yes

### 4. Upstash Redis Credentials

**Purpose**: Rate limiting with Upstash Redis

**Auto-generated**: No (from Upstash dashboard)

**Format**: JSON
```json
{
  "url": "https://xxx.upstash.io",
  "token": "AXX..."
}
```

**Environment Variables**:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Required**: No (optional rate limiting)

### 5. Application Encryption Key

**Purpose**: Encrypt sensitive application settings

**Auto-generated**: Yes (32-character alphanumeric)

**Format**: String

**Environment Variable**: `ENCRYPTION_KEY`

**Required**: Yes

### 6. RDS Database Secret

**Purpose**: PostgreSQL database credentials

**Auto-generated**: By RDS module

**Format**: JSON
```json
{
  "username": "dbadmin",
  "password": "...",
  "engine": "postgres",
  "host": "xxx.rds.amazonaws.com",
  "port": 5432,
  "dbname": "rfp_copilot"
}
```

**Environment Variable**: `DATABASE_URL`

**Required**: Yes (imported from RDS module)

## Features

### Security
- ✅ Automatic encryption with AWS KMS
- ✅ IAM-based access control
- ✅ Least privilege access policies
- ✅ Auto-generated strong passwords
- ✅ Recovery window for deletion
- ✅ CloudWatch monitoring and alarms
- ✅ Automatic rotation support (RDS)

### Management
- ✅ Centralized secret storage
- ✅ Version control for secrets
- ✅ Easy retrieval in application code
- ✅ ECS/Fargate integration
- ✅ Custom secrets support
- ✅ Terraform lifecycle management

### Compliance
- ✅ Audit trail via CloudTrail
- ✅ Encryption at rest
- ✅ No secrets in code or environment
- ✅ Secret rotation capability
- ✅ Access monitoring

## Variables

### Required Variables

| Variable | Description | Type | Example |
|----------|-------------|------|---------|
| `project_name` | Project name | `string` | `"transparent-rfp"` |
| `environment` | Environment name | `string` | `"production"` |

### Secret Values

| Variable | Description | Type | Required | Default |
|----------|-------------|------|----------|---------|
| `anthropic_api_key_value` | Anthropic API key | `string` (sensitive) | If creating | `""` |
| `google_client_id` | Google OAuth client ID | `string` | If creating | `""` |
| `google_client_secret` | Google OAuth secret | `string` (sensitive) | If creating | `""` |
| `upstash_redis_url` | Upstash Redis URL | `string` | If creating | `""` |
| `upstash_redis_token` | Upstash Redis token | `string` (sensitive) | If creating | `""` |

### Creation Flags

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `create_nextauth_secret` | Create NextAuth secret | `bool` | `true` |
| `create_anthropic_secret` | Create Anthropic key secret | `bool` | `true` |
| `create_google_oauth_secret` | Create Google OAuth secret | `bool` | `true` |
| `create_upstash_redis_secret` | Create Redis secret | `bool` | `false` |
| `create_encryption_key` | Create encryption key | `bool` | `true` |
| `import_rds_secret` | Import RDS secret | `bool` | `false` |

### IAM & Access

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `app_role_name` | Application IAM role name | `string` | `""` |
| `kms_key_arn` | Custom KMS key ARN | `string` | `""` |

### Rotation

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `enable_rds_rotation` | Enable RDS rotation | `bool` | `false` |
| `rotation_days` | Days between rotations | `number` | `30` |
| `lambda_subnet_ids` | Lambda subnet IDs | `list(string)` | `[]` |
| `lambda_security_group_ids` | Lambda SG IDs | `list(string)` | `[]` |

### Management

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `recovery_window_in_days` | Deletion recovery window | `number` | `30` |
| `enable_cloudwatch_alarms` | Enable alarms | `bool` | `true` |
| `alarm_sns_topic_arn` | SNS topic for alarms | `string` | `""` |

## Outputs

| Output | Description |
|--------|-------------|
| `nextauth_secret_arn` | NextAuth secret ARN |
| `anthropic_api_key_secret_arn` | Anthropic key ARN |
| `google_oauth_secret_arn` | Google OAuth ARN |
| `upstash_redis_secret_arn` | Redis credentials ARN |
| `encryption_key_secret_arn` | Encryption key ARN |
| `database_secret_arn` | RDS secret ARN (if imported) |
| `secrets_access_policy_arn` | IAM policy ARN |
| `secrets_summary` | Summary of all secrets |
| `environment_variables_template` | ECS task definition template |

## Usage

### Basic Usage

```hcl
module "secrets" {
  source = "./infrastructure/secrets-manager"

  project_name = "transparent-rfp"
  environment  = "production"

  # Provide secret values (use terraform.tfvars or environment variables)
  anthropic_api_key_value = var.anthropic_api_key
  google_client_id        = var.google_client_id
  google_client_secret    = var.google_client_secret

  # Attach to application role
  app_role_name = module.iam.app_runtime_role_name

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With RDS Secret Import and Rotation

```hcl
module "secrets" {
  source = "./infrastructure/secrets-manager"

  project_name = "transparent-rfp"
  environment  = "production"

  # Import RDS secret
  import_rds_secret     = true
  database_secret_name  = module.rds.database_secret_name

  # Enable automatic rotation
  enable_rds_rotation        = true
  rotation_days              = 30
  lambda_subnet_ids          = module.vpc.private_subnet_ids
  lambda_security_group_ids  = [module.security_groups.app_security_group_id]

  # Other secrets
  anthropic_api_key_value = var.anthropic_api_key
  google_client_id        = var.google_client_id
  google_client_secret    = var.google_client_secret

  app_role_name = module.iam.app_runtime_role_name

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### With Custom Secrets

```hcl
module "secrets" {
  source = "./infrastructure/secrets-manager"

  project_name = "transparent-rfp"
  environment  = "production"

  anthropic_api_key_value = var.anthropic_api_key
  google_client_id        = var.google_client_id
  google_client_secret    = var.google_client_secret

  # Custom secrets
  custom_secrets = {
    stripe-api-key = {
      description = "Stripe API key for payments"
      value       = var.stripe_api_key
      tags = {
        Purpose = "Payment processing"
      }
    }
    sendgrid-api-key = {
      description = "SendGrid API key for emails"
      value       = var.sendgrid_api_key
      tags = {
        Purpose = "Email delivery"
      }
    }
  }

  app_role_name = module.iam.app_runtime_role_name

  tags = {
    Project   = "Transparent RFP Copilot"
    ManagedBy = "Terraform"
  }
}
```

### Deploy

```bash
cd infrastructure/secrets-manager

# Create terraform.tfvars with sensitive values
cat > terraform.tfvars <<EOF
anthropic_api_key_value = "sk-ant-xxx"
google_client_id        = "xxx.apps.googleusercontent.com"
google_client_secret    = "GOCSPX-xxx"
EOF

# Or use environment variables
export TF_VAR_anthropic_api_key_value="sk-ant-xxx"
export TF_VAR_google_client_id="xxx.apps.googleusercontent.com"
export TF_VAR_google_client_secret="GOCSPX-xxx"

# Initialize and apply
terraform init
terraform plan -var="project_name=transparent-rfp" -var="environment=production"
terraform apply -var="project_name=transparent-rfp" -var="environment=production"
```

## Accessing Secrets

### From Application Code (Node.js/TypeScript)

```typescript
// lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString || "";
}

export async function getJSONSecret(secretName: string): Promise<any> {
  const secretString = await getSecret(secretName);
  return JSON.parse(secretString);
}

// Usage
const anthropicKey = await getSecret("transparent-rfp-anthropic-api-key-production");
const googleOAuth = await getJSONSecret("transparent-rfp-google-oauth-production");
console.log(googleOAuth.client_id);
```

### From ECS Task Definition

```json
{
  "containerDefinitions": [
    {
      "name": "app",
      "image": "xxx.dkr.ecr.us-east-1.amazonaws.com/app:latest",
      "secrets": [
        {
          "name": "NEXTAUTH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-rfp-nextauth-secret-production"
        },
        {
          "name": "ANTHROPIC_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-rfp-anthropic-api-key-production"
        },
        {
          "name": "GOOGLE_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-rfp-google-oauth-production:client_id::"
        },
        {
          "name": "GOOGLE_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-rfp-google-oauth-production:client_secret::"
        }
      ]
    }
  ]
}
```

### From AWS CLI

```bash
# Get secret value
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-nextauth-secret-production \
  --query SecretString \
  --output text

# Get JSON secret
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-google-oauth-production \
  --query SecretString \
  --output text | jq -r '.client_id'

# List all secrets
aws secretsmanager list-secrets \
  --filters Key=name,Values=transparent-rfp \
  --query 'SecretList[*].{Name:Name,ARN:ARN}' \
  --output table
```

### Environment Variable Helper

```bash
# Helper script to export secrets as environment variables
#!/bin/bash

export NEXTAUTH_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-nextauth-secret-production \
  --query SecretString --output text)

export ANTHROPIC_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-anthropic-api-key-production \
  --query SecretString --output text)

GOOGLE_OAUTH=$(aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-google-oauth-production \
  --query SecretString --output text)

export GOOGLE_CLIENT_ID=$(echo $GOOGLE_OAUTH | jq -r '.client_id')
export GOOGLE_CLIENT_SECRET=$(echo $GOOGLE_OAUTH | jq -r '.client_secret')

echo "Secrets loaded"
```

## Automatic Rotation

### RDS Secret Rotation

This module supports automatic rotation of RDS database credentials.

**How it works**:
1. Lambda function generates new password
2. Creates new user in database with new password
3. Tests connectivity with new credentials
4. Updates secret with new credentials
5. Removes old user from database

**Prerequisites**:
- RDS instance must be accessible from Lambda (VPC configuration)
- Lambda must have network access to RDS
- Security group must allow Lambda → RDS traffic

**Enable rotation**:

```hcl
module "secrets" {
  # ... other configuration ...

  enable_rds_rotation = true
  rotation_days       = 30  # Rotate every 30 days

  # Lambda needs VPC access to RDS
  lambda_subnet_ids         = module.vpc.private_subnet_ids
  lambda_security_group_ids = [aws_security_group.lambda_rds_access.id]
}
```

**Monitor rotation**:

```bash
# Check rotation status
aws secretsmanager describe-secret \
  --secret-id transparent-rfp-db-credentials-production \
  --query 'RotationEnabled'

# View rotation history
aws secretsmanager list-secret-version-ids \
  --secret-id transparent-rfp-db-credentials-production \
  --include-planned

# Manually trigger rotation
aws secretsmanager rotate-secret \
  --secret-id transparent-rfp-db-credentials-production
```

## Security Best Practices

### 1. Never Commit Secrets to Git

❌ **Bad**:
```hcl
variable "anthropic_api_key" {
  default = "sk-ant-xxx"  # NEVER DO THIS
}
```

✅ **Good**:
```hcl
variable "anthropic_api_key" {
  sensitive = true
  # Value provided via terraform.tfvars or environment variable
}
```

### 2. Use terraform.tfvars for Secrets

Create `terraform.tfvars` (add to `.gitignore`):
```hcl
anthropic_api_key_value = "sk-ant-xxx"
google_client_secret    = "GOCSPX-xxx"
```

Or use environment variables:
```bash
export TF_VAR_anthropic_api_key_value="sk-ant-xxx"
export TF_VAR_google_client_secret="GOCSPX-xxx"
```

### 3. Least Privilege IAM Access

Only grant `secretsmanager:GetSecretValue` to application role:

```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-rfp-*"
}
```

### 4. Enable CloudWatch Alarms

Monitor for:
- Failed access attempts
- Unusual access patterns
- Rotation failures

### 5. Use Recovery Window

Set recovery window to prevent accidental deletion:
```hcl
recovery_window_in_days = 30  # 30-day grace period
```

### 6. Rotate Secrets Regularly

- Database credentials: Every 30-90 days
- API keys: When compromised or annually
- OAuth secrets: When changed in provider

### 7. Audit Access with CloudTrail

```bash
# View secret access logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::SecretsManager::Secret \
  --max-results 50
```

## Troubleshooting

### Access Denied Error

**Symptom**: Application cannot read secrets

**Solution**:
```bash
# Check IAM policy is attached
aws iam list-attached-role-policies \
  --role-name transparent-rfp-app-role-production

# Test secret access with role
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/transparent-rfp-app-role-production \
  --role-session-name test

# Use temporary credentials to test
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-nextauth-secret-production \
  --profile assumed-role
```

### Secret Not Found

**Symptom**: Secret does not exist

**Solution**:
```bash
# List secrets with prefix
aws secretsmanager list-secrets \
  --filters Key=name,Values=transparent-rfp

# Check Terraform state
terraform state list | grep secrets

# Re-apply Terraform
terraform apply
```

### Rotation Failures

**Symptom**: Rotation Lambda fails

**Common causes**:
1. Lambda cannot reach RDS (network/security group)
2. Insufficient Lambda permissions
3. Database connection issues

**Solution**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/transparent-rfp-rds-rotation-production --follow

# Test Lambda network access
aws lambda invoke \
  --function-name transparent-rfp-rds-rotation-production \
  --payload '{"Step": "testConnection"}' \
  response.json

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids <lambda-sg-id> <rds-sg-id>
```

### KMS Permissions Error

**Symptom**: Cannot decrypt secret

**Solution**:
```bash
# Check KMS key policy
aws kms describe-key --key-id <key-id>
aws kms get-key-policy --key-id <key-id> --policy-name default

# Verify role can use KMS
aws kms decrypt --key-id <key-id> \
  --ciphertext-blob fileb://test.enc \
  --profile app-role
```

---

**Module Version**: 1.0
**Last Updated**: 2025-12-18
**Terraform Version**: >= 1.0
**AWS Provider Version**: ~> 5.0
