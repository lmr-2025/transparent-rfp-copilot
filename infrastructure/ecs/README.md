# ECS/Fargate Infrastructure for Transparent Trust

Complete AWS ECS with Fargate infrastructure for deploying the Transparent Trust Next.js application.

**Reference**: [SEC-1047 - ECS/Fargate deployment](https://linear.app/montecarlodata/issue/SEC-1047)

## Overview

This Terraform module provisions a complete ECS/Fargate deployment including:

- **ECS Cluster** with Container Insights
- **ECR Repository** for Docker images with lifecycle policies
- **ECS Task Definition** with secrets from Secrets Manager
- **ECS Service** with ALB integration
- **Auto Scaling** based on CPU and memory
- **CloudWatch Logs** with configurable retention
- **CloudWatch Alarms** for monitoring
- **Security Groups** with least privilege access

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet Gateway                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │  Application Load       │
         │  Balancer (ALB)         │
         │  - Port 443 (HTTPS)     │
         └────────────┬────────────┘
                      │
                      ▼
         ┌─────────────────────────┐
         │  ECS Service            │
         │  - Auto Scaling         │
         │  - Health Checks        │
         └────────────┬────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌───────────────┐            ┌───────────────┐
│ ECS Task      │            │ ECS Task      │
│ (Fargate)     │            │ (Fargate)     │
│               │            │               │
│ ┌───────────┐ │            │ ┌───────────┐ │
│ │ Next.js   │ │            │ │ Next.js   │ │
│ │ Container │ │            │ │ Container │ │
│ │ Port 3000 │ │            │ │ Port 3000 │ │
│ └───────────┘ │            │ └───────────┘ │
└───────┬───────┘            └───────┬───────┘
        │                            │
        └────────────┬───────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Secrets Manager │    │ RDS PostgreSQL  │
│ - API Keys      │    │ - Private       │
│ - Auth Secrets  │    │ - Encrypted     │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ S3 Buckets      │
│ - Uploads       │
│ - Logs          │
└─────────────────┘
```

## Features

### Core Infrastructure

- **Fargate Launch Type**: Serverless container execution (no EC2 management)
- **Fargate Spot Support**: Optional cost savings with Spot instances
- **Multi-AZ Deployment**: High availability across availability zones
- **Container Insights**: Advanced monitoring and observability
- **ECS Exec**: Optional SSH-like access for debugging

### Security

- **Private Networking**: Tasks run in private subnets
- **Security Groups**: Least privilege network access
- **Secrets Integration**: Automatic injection from Secrets Manager
- **ECR Encryption**: KMS encryption for container images
- **Log Encryption**: Optional KMS encryption for CloudWatch Logs
- **Image Scanning**: Automatic vulnerability scanning on push

### Scalability

- **Auto Scaling**: CPU and memory-based scaling
- **Configurable Limits**: Min 2, max 10 tasks (adjustable)
- **Rolling Deployments**: Zero-downtime updates
- **Health Checks**: Container and ALB health checks

### Monitoring

- **CloudWatch Logs**: Centralized application logs
- **Container Insights**: CPU, memory, network metrics
- **CloudWatch Alarms**: Proactive alerting
- **SNS Integration**: Alarm notifications

## Prerequisites

Before using this module, ensure you have:

1. **VPC Infrastructure** (SEC-1051):
   - VPC with private subnets
   - NAT Gateway for outbound connectivity
   - Security groups configured

2. **IAM Roles** (SEC-1046):
   - ECS task execution role
   - ECS task role with app permissions

3. **Secrets Manager** (SEC-1056):
   - Database credentials
   - API keys (Anthropic)
   - Authentication secrets (NextAuth, Google OAuth)
   - Encryption keys

4. **RDS Database** (SEC-1049):
   - PostgreSQL instance
   - Database created
   - Migrations applied

5. **S3 Buckets** (SEC-1054):
   - Upload bucket
   - Log buckets

6. **Application Load Balancer** (SEC-1052):
   - ALB in public subnets
   - Target group configured
   - HTTPS listener with SSL certificate

7. **Docker Image**:
   - Dockerfile for Next.js app
   - Initial image pushed to ECR

## Variables

### Required Variables

| Variable | Description | Type |
|----------|-------------|------|
| `vpc_id` | ID of the VPC | string |
| `private_subnet_ids` | List of private subnet IDs | list(string) |
| `ecs_execution_role_arn` | ARN of ECS execution role | string |
| `ecs_task_role_arn` | ARN of ECS task role | string |
| `database_secret_arn` | Database secret ARN | string |
| `nextauth_secret_arn` | NextAuth secret ARN | string |
| `anthropic_secret_arn` | Anthropic API key ARN | string |
| `google_oauth_secret_arn` | Google OAuth secret ARN | string |
| `encryption_key_secret_arn` | Encryption key ARN | string |
| `nextauth_url` | Public URL (e.g., https://app.example.com) | string |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project name for resources | `transparent-trust` |
| `environment` | Environment name | `production` |
| `aws_region` | AWS region | `us-east-1` |
| `task_cpu` | CPU units (256, 512, 1024, 2048, 4096) | `512` |
| `task_memory` | Memory in MB | `1024` |
| `desired_count` | Number of tasks to run | `2` |
| `enable_autoscaling` | Enable auto scaling | `true` |
| `autoscaling_min_capacity` | Minimum tasks | `2` |
| `autoscaling_max_capacity` | Maximum tasks | `10` |
| `autoscaling_cpu_target` | CPU target % | `70` |
| `autoscaling_memory_target` | Memory target % | `80` |
| `enable_container_insights` | Enable Container Insights | `true` |
| `use_fargate_spot` | Use Fargate Spot | `false` |
| `log_retention_days` | CloudWatch log retention | `30` |
| `enable_alarms` | Enable CloudWatch alarms | `true` |

See [variables.tf](./variables.tf) for complete list.

## Outputs

| Output | Description |
|--------|-------------|
| `cluster_name` | Name of the ECS cluster |
| `service_name` | Name of the ECS service |
| `ecr_repository_url` | ECR repository URL for pushing images |
| `cloudwatch_log_group_name` | CloudWatch log group name |
| `deployment_info` | Summary of deployment configuration |
| `useful_commands` | Quick reference commands |

See [outputs.tf](./outputs.tf) for complete list.

## Usage

### Basic Setup

```hcl
module "ecs" {
  source = "./infrastructure/ecs"

  # Networking
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn   = module.alb.target_group_arn

  # IAM Roles
  ecs_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn      = module.iam.app_runtime_role_arn

  # Secrets
  database_secret_arn        = module.secrets.database_secret_arn
  nextauth_secret_arn        = module.secrets.nextauth_secret_arn
  anthropic_secret_arn       = module.secrets.anthropic_secret_arn
  google_oauth_secret_arn    = module.secrets.google_oauth_secret_arn
  encryption_key_secret_arn  = module.secrets.encryption_key_secret_arn
  redis_secret_arn           = module.secrets.redis_secret_arn

  # Application
  nextauth_url = "https://app.example.com"
  
  # Environment
  environment = "production"
}
```

### Production Configuration

```hcl
module "ecs" {
  source = "./infrastructure/ecs"

  # ... basic configuration ...

  # Task sizing
  task_cpu    = 1024  # 1 vCPU
  task_memory = 2048  # 2 GB

  # High availability
  desired_count = 3

  # Auto scaling
  enable_autoscaling        = true
  autoscaling_min_capacity  = 3
  autoscaling_max_capacity  = 20
  autoscaling_cpu_target    = 70
  autoscaling_memory_target = 80

  # Monitoring
  enable_container_insights = true
  enable_alarms            = true
  alarm_sns_topic_arn      = aws_sns_topic.alerts.arn
  log_retention_days       = 90

  # Cost optimization
  use_fargate_spot = false  # Keep false for production

  tags = {
    Project     = "transparent-trust"
    Environment = "production"
    CostCenter  = "engineering"
  }
}
```

### Development Configuration

```hcl
module "ecs" {
  source = "./infrastructure/ecs"

  # ... basic configuration ...

  environment = "development"

  # Minimal resources for cost savings
  task_cpu    = 256
  task_memory = 512
  desired_count = 1

  # Disable auto scaling for dev
  enable_autoscaling = false

  # Use Fargate Spot for cost savings
  use_fargate_spot = true

  # Shorter log retention
  log_retention_days = 7

  # Disable alarms in dev
  enable_alarms = false
}
```

## Deployment Workflow

### 1. Create Dockerfile

Create a `Dockerfile` in your project root:

```dockerfile
# Multi-stage build for Next.js
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 2. Update next.config.ts

Enable standalone output:

```typescript
const nextConfig = {
  output: 'standalone',
  // ... other config
};

export default nextConfig;
```

### 3. Provision Infrastructure

```bash
cd infrastructure/ecs
terraform init
terraform plan -var="environment=production"
terraform apply -var="environment=production"
```

### 4. Build and Push Docker Image

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t transparent-trust:latest .

# Tag image
docker tag transparent-trust:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:latest
```

### 5. Deploy to ECS

```bash
# Force new deployment (pulls latest image)
aws ecs update-service \
  --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production \
  --force-new-deployment
```

### 6. Monitor Deployment

```bash
# Watch service events
aws ecs describe-services \
  --cluster transparent-trust-cluster-production \
  --services transparent-trust-service-production \
  --query 'services[0].events[0:5]'

# View logs
aws logs tail /aws/ecs/transparent-trust-production --follow

# Check task status
aws ecs list-tasks \
  --cluster transparent-trust-cluster-production \
  --service-name transparent-trust-service-production
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy-ecs.yml`:

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: transparent-trust-production
  ECS_CLUSTER: transparent-trust-cluster-production
  ECS_SERVICE: transparent-trust-service-production

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
                     $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE
```

## Task CPU and Memory Combinations

Valid Fargate CPU/Memory combinations:

| CPU (vCPU) | Memory Options (MB) |
|------------|---------------------|
| 256 (.25)  | 512, 1024, 2048 |
| 512 (.5)   | 1024, 2048, 3072, 4096 |
| 1024 (1)   | 2048, 3072, 4096, 5120, 6144, 7168, 8192 |
| 2048 (2)   | 4096 to 16384 (1024 increments) |
| 4096 (4)   | 8192 to 30720 (1024 increments) |

## Cost Optimization

### Fargate Pricing (us-east-1)

- **CPU**: $0.04048 per vCPU per hour
- **Memory**: $0.004445 per GB per hour

### Example Costs

**Development** (256 CPU, 512 MB, 1 task):
- Monthly: ~$10

**Production** (512 CPU, 1024 MB, 2 tasks):
- Monthly: ~$30

**High Availability** (1024 CPU, 2048 MB, 3 tasks):
- Monthly: ~$90

### Cost Saving Tips

1. **Use Fargate Spot**: 70% savings, acceptable for dev/staging
2. **Right-size tasks**: Monitor CPU/memory and adjust
3. **Implement auto scaling**: Scale down during low traffic
4. **Use ECR lifecycle policies**: Reduce storage costs
5. **Optimize log retention**: Reduce CloudWatch costs
6. **Schedule scaling**: Scale down during off-hours

## Monitoring

### CloudWatch Metrics

Available metrics with Container Insights:

- **CPU Utilization**: `ECSServiceAverageCPUUtilization`
- **Memory Utilization**: `ECSServiceAverageMemoryUtilization`
- **Task Count**: `RunningTaskCount`
- **Network In/Out**: `NetworkRxBytes`, `NetworkTxBytes`

### Alarms

Pre-configured alarms:

1. **High CPU**: Triggers at 80% CPU utilization
2. **High Memory**: Triggers at 80% memory utilization
3. **Low Task Count**: Triggers when no tasks are running

### Log Analysis

```bash
# View recent logs
aws logs tail /aws/ecs/transparent-trust-production --since 1h

# Search for errors
aws logs filter-pattern /aws/ecs/transparent-trust-production \
  --pattern "ERROR"

# Export logs to S3
aws logs create-export-task \
  --log-group-name /aws/ecs/transparent-trust-production \
  --from $(date -d '7 days ago' +%s)000 \
  --to $(date +%s)000 \
  --destination logs-bucket
```

## Troubleshooting

### Common Issues

#### 1. Tasks Not Starting

**Symptom**: Tasks stuck in PENDING or immediately stop

**Checks**:
```bash
# Check service events
aws ecs describe-services \
  --cluster <cluster-name> \
  --services <service-name> \
  --query 'services[0].events[0:10]'

# Check task status
aws ecs describe-tasks \
  --cluster <cluster-name> \
  --tasks <task-arn> \
  --query 'tasks[0].stoppedReason'
```

**Common causes**:
- Insufficient ENIs in subnet
- ECR image pull failures (check execution role)
- Secrets Manager access denied (check execution role)
- Invalid task definition (check CPU/memory combination)

#### 2. Health Check Failures

**Symptom**: Tasks start but fail ALB health checks

**Checks**:
```bash
# View application logs
aws logs tail /aws/ecs/transparent-trust-production --follow

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

**Common causes**:
- Application not listening on correct port (3000)
- Health check path not responding (`/api/health`)
- Database connection failures
- Missing environment variables

#### 3. High Memory/CPU

**Symptom**: Tasks restarting or throttling

**Checks**:
```bash
# View Container Insights metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=<service-name> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Solutions**:
- Increase task CPU/memory
- Optimize application code
- Add caching (Redis)
- Enable auto scaling

#### 4. Deployment Stuck

**Symptom**: New deployment not completing

**Checks**:
```bash
# Check deployment status
aws ecs describe-services \
  --cluster <cluster-name> \
  --services <service-name> \
  --query 'services[0].deployments'
```

**Solutions**:
```bash
# Force new deployment
aws ecs update-service \
  --cluster <cluster-name> \
  --service <service-name> \
  --force-new-deployment

# Roll back to previous task definition
aws ecs update-service \
  --cluster <cluster-name> \
  --service <service-name> \
  --task-definition <previous-task-def>
```

### Debug with ECS Exec

Enable ECS Exec in variables:
```hcl
enable_execute_command = true
```

Access running container:
```bash
# List tasks
TASK_ARN=$(aws ecs list-tasks \
  --cluster <cluster-name> \
  --service-name <service-name> \
  --query 'taskArns[0]' \
  --output text)

# Execute command
aws ecs execute-command \
  --cluster <cluster-name> \
  --task $TASK_ARN \
  --container app \
  --interactive \
  --command "/bin/sh"
```

## Security Best Practices

1. **Use Private Subnets**: Never expose ECS tasks directly
2. **Secrets Manager**: Never hardcode secrets in task definitions
3. **IAM Least Privilege**: Grant only required permissions
4. **Image Scanning**: Enable ECR vulnerability scanning
5. **Network Isolation**: Use security groups effectively
6. **Log Encryption**: Enable KMS encryption for sensitive logs
7. **Container Insights**: Monitor for anomalous behavior
8. **Regular Updates**: Keep base images and dependencies updated
9. **No Root User**: Run containers as non-root user
10. **Read-Only Root Filesystem**: When possible, make filesystem read-only

## Maintenance

### Regular Tasks

**Weekly**:
- Review CloudWatch logs for errors
- Check Container Insights metrics
- Review alarm history

**Monthly**:
- Review ECR image count and cleanup old images
- Review and optimize task sizing
- Check for available AWS updates
- Review auto scaling metrics and adjust thresholds

**Quarterly**:
- Security audit (IAM, security groups, secrets)
- Cost optimization review
- Disaster recovery drill
- Update documentation

### Updates

**Application Updates**:
1. Build new Docker image with version tag
2. Push to ECR
3. Update ECS service (force new deployment)
4. Monitor rollout via CloudWatch

**Infrastructure Updates**:
1. Review Terraform changes
2. Run `terraform plan`
3. Apply during maintenance window
4. Verify service health

## Related Documentation

- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html)
- [ECS Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)

## Support

For issues or questions:
- **Linear**: [SEC-1047](https://linear.app/montecarlodata/issue/SEC-1047)
- **AWS Support**: Check AWS Support Center
- **Terraform**: [ECS Module Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service)
