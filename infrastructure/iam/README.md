# IAM Roles and Policies

This directory contains Terraform configurations for all IAM roles required by the Transparent Trust application.

**Linear Issue**: [SEC-1046 - IAM Roles for Application Services](https://linear.app/montecarlodata/issue/SEC-1046)

## Overview

This module creates IAM roles following the principle of least privilege for:
- ECS/Fargate task execution
- Application runtime (access to AWS services)
- Lambda functions (optional)
- RDS enhanced monitoring

## Roles Created

### 1. ECS Task Execution Role
**File**: `ecs-task-execution-role.tf`
**Role Name**: `transparent-trust-ecs-execution-role`
**Purpose**: Allows ECS to pull container images from ECR and publish logs to CloudWatch

**Permissions**:
- Pull container images from ECR
- Create and write to CloudWatch Logs
- Retrieve secrets from Secrets Manager (for environment variables)
- Decrypt secrets using KMS

**AWS Managed Policies**:
- `AmazonECSTaskExecutionRolePolicy`

**Use in ECS Task Definition**:
```json
{
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/transparent-trust-ecs-execution-role"
}
```

---

### 2. Application Runtime Role (Task Role)
**File**: `app-runtime-role.tf`
**Role Name**: `transparent-trust-app-runtime-role`
**Purpose**: Runtime permissions for the application container to access AWS services

**Permissions**:
- **S3**: Read/write access to upload buckets
  - `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`
  - Scoped to: `transparent-trust-uploads-{environment}` bucket
- **Secrets Manager**: Read application secrets
  - `secretsmanager:GetSecretValue`, `secretsmanager:DescribeSecret`
  - Scoped to: `transparent-trust/*` secrets
- **CloudWatch Logs**: Write application logs
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- **RDS**: IAM database authentication (optional but recommended)
  - `rds-db:connect`
- **CloudWatch Metrics**: Publish custom metrics
  - `cloudwatch:PutMetricData` (scoped to `TransparentTrust/*` namespace)
- **X-Ray**: Distributed tracing (if enabled)
  - `xray:PutTraceSegments`, `xray:PutTelemetryRecords`

**Use in ECS Task Definition**:
```json
{
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/transparent-trust-app-runtime-role"
}
```

---

### 3. Lambda Execution Roles (Optional)
**File**: `lambda-execution-roles.tf`
**Roles**:
- `transparent-trust-lambda-execution-role` - Base Lambda role
- `transparent-trust-lambda-doc-processor-role` - Document processing Lambda

**Purpose**: Execute Lambda functions for async processing, scheduled tasks, or document processing

**Permissions**:
- Basic Lambda execution (CloudWatch Logs)
- VPC access (if Lambda needs to connect to RDS/ElastiCache)
- Read secrets from Secrets Manager
- Read/write to S3 upload bucket
- AWS Textract for document processing (document processor role only)

**When to Enable**:
Set `enable_lambda = true` in variables if you plan to use:
- Async document processing
- Scheduled maintenance tasks
- Webhook handlers
- Event-driven workflows

---

### 4. RDS Enhanced Monitoring Role
**File**: `rds-monitoring-role.tf`
**Role Name**: `transparent-trust-rds-monitoring-role`
**Purpose**: Allows RDS to publish enhanced monitoring metrics to CloudWatch

**Permissions**:
- Publish RDS OS-level metrics to CloudWatch

**AWS Managed Policies**:
- `AmazonRDSEnhancedMonitoringRole`

**Use in RDS Configuration**:
```terraform
resource "aws_db_instance" "main" {
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_enhanced_monitoring.arn
}
```

## Deployment

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- AWS account with permission to create IAM roles

### Apply Infrastructure

```bash
# Navigate to IAM directory
cd infrastructure/iam

# Initialize Terraform
terraform init

# Review planned changes
terraform plan -var="environment=production"

# Apply configuration
terraform apply -var="environment=production"
```

### Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `environment` | Environment name | `production` | No |
| `aws_region` | AWS region | `us-east-1` | No |
| `enable_lambda` | Create Lambda roles | `false` | No |
| `lambda_vpc_access` | Lambda VPC access | `false` | No |
| `enable_xray` | Enable X-Ray tracing | `false` | No |

### Example Usage

**Production deployment**:
```bash
terraform apply \
  -var="environment=production" \
  -var="aws_region=us-east-1" \
  -var="enable_lambda=false" \
  -var="enable_xray=true"
```

**Staging with Lambda**:
```bash
terraform apply \
  -var="environment=staging" \
  -var="enable_lambda=true" \
  -var="lambda_vpc_access=true"
```

## Outputs

After applying, Terraform will output the ARNs needed for other infrastructure components:

```
ecs_task_execution_role_arn = "arn:aws:iam::123456789012:role/transparent-trust-ecs-execution-role"
app_runtime_role_arn = "arn:aws:iam::123456789012:role/transparent-trust-app-runtime-role"
rds_enhanced_monitoring_role_arn = "arn:aws:iam::123456789012:role/transparent-trust-rds-monitoring-role"
lambda_execution_role_arn = "arn:aws:iam::123456789012:role/transparent-trust-lambda-execution-role" # if enabled
```

## Security Best Practices

1. **Least Privilege**: Each role has only the minimum permissions required
2. **Resource Scoping**: Policies are scoped to specific resources (e.g., specific S3 buckets, secret paths)
3. **Service Principals**: Roles can only be assumed by specific AWS services
4. **Condition Keys**: KMS policies use condition keys to restrict decryption to specific services
5. **No Wildcards**: Avoid `Resource: "*"` except where AWS requires it (e.g., CloudWatch metrics)

## Compliance

These roles are designed to meet:
- SOC 2 Type II requirements
- AWS Well-Architected Framework security pillar
- Principle of least privilege (PoLP)
- Defense in depth

## Troubleshooting

### Access Denied Errors

**ECS Task fails to start**:
- Check that task definition uses correct execution role ARN
- Verify ECR permissions in execution role
- Check CloudWatch Logs permissions

**Application can't access S3**:
- Verify task definition uses correct task role (not execution role)
- Check S3 bucket name matches policy
- Verify bucket exists and is in same region

**Can't read secrets**:
- Check Secrets Manager secret name matches pattern `transparent-trust/*`
- Verify KMS key permissions
- Check secret exists in correct region

### Permission Debugging

```bash
# Test assume role
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/transparent-trust-app-runtime-role \
  --role-session-name test

# Simulate policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT_ID:role/transparent-trust-app-runtime-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::transparent-trust-uploads-production/*
```

## Related Documentation

- [AWS_DEPLOYMENT.md](../../docs/AWS_DEPLOYMENT.md) - Full deployment guide
- [Phase 1.2 - IAM Roles](../../docs/AWS_DEPLOYMENT.md#12-iam-roles-for-application-services-sec-1046)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [ECS Task Roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)

## Support

For questions or issues:
- Linear: [SEC-1046](https://linear.app/montecarlodata/issue/SEC-1046)
- Repository: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
