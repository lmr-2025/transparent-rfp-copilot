# IAM Roles and Policies Documentation

**Linear Issue**: [SEC-1046 - IAM Roles for Application Services](https://linear.app/montecarlodata/issue/SEC-1046)

## Overview

This document provides a comprehensive overview of all IAM roles and policies created for the Transparent Trust application. All roles follow the principle of least privilege and are scoped to specific resources.

## Table of Contents

1. [Role Summary](#role-summary)
2. [Detailed Role Descriptions](#detailed-role-descriptions)
3. [Policy Matrices](#policy-matrices)
4. [Security Best Practices](#security-best-practices)
5. [Deployment Instructions](#deployment-instructions)

---

## Role Summary

| Role Name | Purpose | Used By | Required |
|-----------|---------|---------|----------|
| `transparent-trust-ecs-execution-role` | Pull images, create logs, retrieve secrets | ECS/Fargate | Yes |
| `transparent-trust-app-runtime-role` | Access AWS services at runtime | Application container | Yes |
| `transparent-trust-lambda-execution-role` | Execute Lambda functions | Lambda | Optional |
| `transparent-trust-lambda-doc-processor-role` | Process uploaded documents | Lambda | Optional |
| `transparent-trust-rds-monitoring-role` | Publish RDS metrics | RDS Enhanced Monitoring | Yes |

---

## Detailed Role Descriptions

### 1. ECS Task Execution Role

**ARN**: `arn:aws:iam::ACCOUNT_ID:role/transparent-trust-ecs-execution-role`

**Trust Policy** (Who can assume this role):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

**Permissions**:

| Service | Actions | Resources | Purpose |
|---------|---------|-----------|---------|
| ECR | `GetAuthorizationToken`, `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, `BatchGetImage` | All ECR repositories | Pull container images |
| CloudWatch Logs | `CreateLogStream`, `PutLogEvents` | `/aws/ecs/transparent-trust-*` | Publish container logs |
| Secrets Manager | `GetSecretValue` | `transparent-trust/*` | Retrieve secrets for env vars |
| KMS | `Decrypt` | All keys (scoped by condition) | Decrypt secrets |

**Managed Policies**:
- `arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`

**When to Use**:
- Set as `executionRoleArn` in ECS task definition
- Required for ECS to start your container

---

### 2. Application Runtime Role (Task Role)

**ARN**: `arn:aws:iam::ACCOUNT_ID:role/transparent-trust-app-runtime-role`

**Trust Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

**Permissions**:

| Service | Actions | Resources | Purpose |
|---------|---------|-----------|---------|
| S3 | `GetObject`, `PutObject`, `DeleteObject`, `ListBucket` | `transparent-trust-uploads-{env}/*` | File uploads/downloads |
| Secrets Manager | `GetSecretValue`, `DescribeSecret` | `transparent-trust/*` | Read application secrets |
| CloudWatch Logs | `CreateLogGroup`, `CreateLogStream`, `PutLogEvents` | `/aws/ecs/transparent-trust-{env}` | Application logging |
| CloudWatch Metrics | `PutMetricData` | `TransparentTrust/*` namespace | Custom metrics |
| RDS | `rds-db:connect` | All DB users | IAM database auth |
| KMS | `Decrypt`, `DescribeKey` | All keys (scoped by condition) | Decrypt secrets |
| X-Ray | `PutTraceSegments`, `PutTelemetryRecords` | All (if enabled) | Distributed tracing |

**When to Use**:
- Set as `taskRoleArn` in ECS task definition
- This is what your application code assumes at runtime

---

### 3. Lambda Execution Role (Optional)

**ARN**: `arn:aws:iam::ACCOUNT_ID:role/transparent-trust-lambda-execution-role`

**Trust Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

**Permissions**:

| Service | Actions | Resources | Purpose |
|---------|---------|-----------|---------|
| CloudWatch Logs | `CreateLogGroup`, `CreateLogStream`, `PutLogEvents` | `/aws/lambda/transparent-trust-*` | Lambda logging |
| EC2 (VPC) | `CreateNetworkInterface`, `DescribeNetworkInterfaces`, `DeleteNetworkInterface` | All (if VPC enabled) | VPC access |
| S3 | `GetObject`, `PutObject`, `DeleteObject` | `transparent-trust-uploads-{env}/*` | Process files |
| Secrets Manager | `GetSecretValue` | `transparent-trust/*` | Read secrets |
| KMS | `Decrypt` | All keys (scoped) | Decrypt secrets |

**Managed Policies**:
- `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`
- `arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole` (if VPC enabled)

**When to Enable**:
Set `enable_lambda = true` when deploying if you need:
- Async document processing
- Scheduled tasks
- Event-driven workflows

---

### 4. Lambda Document Processor Role (Optional)

**ARN**: `arn:aws:iam::ACCOUNT_ID:role/transparent-trust-lambda-doc-processor-role`

**Additional Permissions** (beyond base Lambda role):

| Service | Actions | Resources | Purpose |
|---------|---------|-----------|---------|
| Textract | `DetectDocumentText`, `AnalyzeDocument` | All | Extract text from documents |
| S3 | `GetObject`, `PutObject` | `transparent-trust-uploads-{env}/*` | Read/write documents |

**Use Case**: Lambda function that extracts text from uploaded PDFs, Word docs using AWS Textract.

---

### 5. RDS Enhanced Monitoring Role

**ARN**: `arn:aws:iam::ACCOUNT_ID:role/transparent-trust-rds-monitoring-role`

**Trust Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "monitoring.rds.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

**Managed Policies**:
- `arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole`

**Permissions**: Allows RDS to publish OS-level metrics (CPU, memory, disk I/O) to CloudWatch.

**When to Use**:
- Set `monitoring_role_arn` in RDS instance configuration
- Required when `monitoring_interval` > 0

---

## Policy Matrices

### Resource Access Matrix

| Role | S3 | RDS | Secrets Manager | CloudWatch Logs | CloudWatch Metrics | KMS |
|------|----|----|-----------------|-----------------|-------------------|-----|
| ECS Execution | ❌ | ❌ | ✅ Read | ✅ Write | ❌ | ✅ Decrypt |
| App Runtime | ✅ Full | ✅ Connect | ✅ Read | ✅ Write | ✅ Write | ✅ Decrypt |
| Lambda Execution | ✅ Full | ❌ | ✅ Read | ✅ Write | ❌ | ✅ Decrypt |
| Lambda Doc Processor | ✅ Full | ❌ | ✅ Read | ✅ Write | ❌ | ✅ Decrypt |
| RDS Monitoring | ❌ | ❌ | ❌ | ✅ Write | ✅ Write | ❌ |

### Service Principal Trust

| Role | Trusted Service |
|------|----------------|
| ECS Execution | `ecs-tasks.amazonaws.com` |
| App Runtime | `ecs-tasks.amazonaws.com` |
| Lambda Execution | `lambda.amazonaws.com` |
| Lambda Doc Processor | `lambda.amazonaws.com` |
| RDS Monitoring | `monitoring.rds.amazonaws.com` |

---

## Security Best Practices

### 1. Least Privilege
- Each role has only the minimum permissions required
- Policies are scoped to specific resources (no `Resource: "*"` except where AWS requires it)
- Actions are limited to what the service actually needs

### 2. Resource Scoping
All policies use specific resource ARNs:
```json
{
  "Resource": [
    "arn:aws:s3:::transparent-trust-uploads-production/*",
    "arn:aws:secretsmanager:us-east-1:123456789012:secret:transparent-trust/*"
  ]
}
```

Not:
```json
{
  "Resource": "*"  // ❌ Avoid this
}
```

### 3. Condition Keys
KMS policies use condition keys to restrict access:
```json
{
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
    }
  }
}
```

### 4. Separation of Concerns
- **Execution Role**: Infrastructure concerns (pull images, publish logs)
- **Task/Runtime Role**: Application concerns (access data, call APIs)

### 5. Defense in Depth
Multiple layers of security:
1. IAM role trust policy (who can assume)
2. IAM permissions policy (what they can do)
3. Resource-based policies (S3 bucket policies)
4. Security groups (network level)
5. Encryption (data at rest and in transit)

---

## Deployment Instructions

### Prerequisites
```bash
# Install Terraform
brew install terraform

# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### Deploy IAM Roles

```bash
# Navigate to IAM infrastructure directory
cd infrastructure/iam

# Initialize Terraform
terraform init

# Review planned changes
terraform plan \
  -var="environment=production" \
  -var="aws_region=us-east-1" \
  -var="enable_lambda=false" \
  -var="enable_xray=false"

# Apply configuration
terraform apply \
  -var="environment=production" \
  -var="aws_region=us-east-1"

# Save outputs
terraform output -json > iam-outputs.json
```

### Verify Deployment

```bash
# List created roles
aws iam list-roles --query "Roles[?starts_with(RoleName, 'transparent-trust')].RoleName"

# Get role details
aws iam get-role --role-name transparent-trust-app-runtime-role

# List attached policies
aws iam list-attached-role-policies --role-name transparent-trust-app-runtime-role
aws iam list-role-policies --role-name transparent-trust-app-runtime-role
```

### Use in ECS Task Definition

```json
{
  "family": "transparent-trust-app",
  "executionRoleArn": "arn:aws:iam::123456789012:role/transparent-trust-ecs-execution-role",
  "taskRoleArn": "arn:aws:iam::123456789012:role/transparent-trust-app-runtime-role",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/transparent-trust:latest",
      "memory": 2048,
      "cpu": 1024,
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/aws/ecs/transparent-trust-production",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "app"
        }
      }
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Access Denied" when ECS tries to start task
**Cause**: Execution role missing permissions
**Solution**:
```bash
# Check execution role has required managed policy
aws iam list-attached-role-policies --role-name transparent-trust-ecs-execution-role

# Should include: AmazonECSTaskExecutionRolePolicy
```

#### 2. Application can't access S3
**Cause**: Using execution role instead of task role
**Solution**: Verify task definition has both roles set correctly:
```json
{
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/transparent-trust-ecs-execution-role",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/transparent-trust-app-runtime-role"
}
```

#### 3. Can't decrypt secrets
**Cause**: Missing KMS permissions
**Solution**: Check KMS policy includes condition key:
```json
{
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
    }
  }
}
```

#### 4. RDS connection using IAM fails
**Cause**: RDS instance not configured for IAM auth
**Solution**:
```bash
# Enable IAM authentication on RDS instance
aws rds modify-db-instance \
  --db-instance-identifier transparent-trust-db \
  --enable-iam-database-authentication \
  --apply-immediately
```

### Permission Testing

```bash
# Simulate policy for specific action
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT:role/transparent-trust-app-runtime-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::transparent-trust-uploads-production/test.pdf

# Test assume role
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT:role/transparent-trust-app-runtime-role \
  --role-session-name test-session
```

---

## Maintenance

### Updating Policies

```bash
# Make changes to .tf files
vim infrastructure/iam/app-runtime-role.tf

# Review changes
terraform plan

# Apply updates
terraform apply

# Verify no drift
terraform plan
```

### Auditing

```bash
# Get last used information
aws iam get-role --role-name transparent-trust-app-runtime-role \
  --query 'Role.RoleLastUsed'

# Review CloudTrail for role usage
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=transparent-trust-app-runtime-role \
  --max-results 10
```

---

## Related Documentation

- [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) - Full deployment guide
- [infrastructure/iam/README.md](../infrastructure/iam/README.md) - Terraform module documentation
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [ECS Task IAM Roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Linear Issue SEC-1046](https://linear.app/montecarlodata/issue/SEC-1046)

---

## Support

For questions or issues:
- **Linear**: [SEC-1046](https://linear.app/montecarlodata/issue/SEC-1046)
- **Repository**: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
- **Team**: Security Engineering
