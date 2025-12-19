# Application Load Balancer

This directory contains Terraform configurations for the Application Load Balancer (ALB) for the Transparent Trust application.

**Linear Issue**: [SEC-1052 - Application Load Balancer](https://linear.app/montecarlodata/issue/SEC-1052)

## Overview

This module creates a production-ready Application Load Balancer with:
- Internet-facing ALB in public subnets across multiple AZs
- Target group for ECS/Fargate tasks
- HTTPS listener with ACM certificate
- HTTP to HTTPS redirect
- Health checks
- Access logs to S3 (optional)
- CloudWatch alarms (optional)

## Architecture

```
                Internet
                    │
                    ▼
        ┌───────────────────────┐
        │  Route 53 (Optional)  │
        │  A Record → ALB       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Application Load      │
        │ Balancer (Multi-AZ)   │
        │                       │
        │ • Public Subnets      │
        │ • us-east-1a/b/c      │
        │ • HTTPS:443 Listener  │
        │ • HTTP:80 → Redirect  │
        └───────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌────────┐          ┌────────┐
    │Target 1│          │Target 2│
    │ECS Task│          │ECS Task│
    │10.0.3.x│          │10.0.4.x│
    │:3000   │          │:3000   │
    └────────┘          └────────┘
    Private Subnet      Private Subnet
```

## Resources Created

### Core Components
- **Application Load Balancer**: Internet-facing ALB in public subnets
- **Target Group**: For ECS/Fargate tasks (IP-based targeting)
- **HTTPS Listener**: Port 443 with SSL/TLS termination
- **HTTP Listener**: Port 80 with redirect to HTTPS
- **Health Checks**: Monitors target health

### Monitoring (Optional)
- **CloudWatch Alarms**:
  - Unhealthy targets
  - 5xx errors
  - High latency
- **Access Logs**: ALB request logs to S3

## Target Group Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Target Type | IP | For Fargate/ECS with awsvpc network mode |
| Port | 3000 | Application listen port |
| Protocol | HTTP | ALB terminates HTTPS, forwards HTTP to targets |
| Health Check Path | /api/health | Endpoint for health checks |
| Health Check Interval | 30s | How often to check |
| Health Check Timeout | 5s | Timeout for each check |
| Healthy Threshold | 2 | Successes needed to mark healthy |
| Unhealthy Threshold | 3 | Failures needed to mark unhealthy |
| Deregistration Delay | 30s | Wait time before removing target |

## SSL/TLS Configuration

**SSL Policy**: `ELBSecurityPolicy-TLS13-1-2-2021-06` (default)
- Supports TLS 1.3 and TLS 1.2
- Modern, secure cipher suites
- Recommended by AWS

**Certificate Management**:
1. Request certificate from ACM
2. Validate via DNS or email
3. Pass certificate ARN to `certificate_arn` variable

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_name` | Project name for tagging | `transparent-trust` | No |
| `environment` | Environment (production/staging/development) | `production` | No |
| `vpc_id` | VPC ID | - | Yes |
| `public_subnet_ids` | Public subnet IDs for ALB | - | Yes |
| `alb_security_group_id` | Security group ID for ALB | - | Yes |
| `app_port` | Application listen port | `3000` | No |
| `enable_https` | Enable HTTPS listener | `true` | No |
| `enable_http_redirect` | Redirect HTTP to HTTPS | `true` | No |
| `certificate_arn` | ACM certificate ARN | `""` | Yes (if HTTPS) |
| `health_check_path` | Health check endpoint | `/api/health` | No |
| `enable_deletion_protection` | Prevent accidental deletion | `true` | No |
| `enable_access_logs` | Log requests to S3 | `false` | No |
| `access_logs_bucket` | S3 bucket for logs | `""` | Yes (if logs enabled) |
| `enable_alb_alarms` | Create CloudWatch alarms | `true` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `alb_dns_name` | DNS name of the ALB (for Route 53) |
| `alb_zone_id` | Zone ID for Route 53 alias record |
| `alb_arn` | ALB ARN |
| `target_group_arn` | Target group ARN (for ECS service) |
| `https_listener_arn` | HTTPS listener ARN |

## Deployment

### Prerequisites

```bash
# VPC and security groups must be deployed first
cd ../vpc && terraform apply
cd ../security-groups && terraform apply
```

### Request SSL Certificate

```bash
# Request certificate from ACM
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --subject-alternative-names "*.yourdomain.com" \
  --region us-east-1

# Note the certificate ARN
CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/..."
```

### Deploy ALB

```bash
# Navigate to ALB directory
cd infrastructure/alb

# Initialize Terraform
terraform init

# Get VPC and security group info
VPC_ID=$(cd ../vpc && terraform output -raw vpc_id)
PUBLIC_SUBNETS=$(cd ../vpc && terraform output -json public_subnet_ids)
ALB_SG=$(cd ../security-groups && terraform output -raw alb_security_group_id)

# Review planned changes
terraform plan \
  -var="vpc_id=$VPC_ID" \
  -var="public_subnet_ids=$PUBLIC_SUBNETS" \
  -var="alb_security_group_id=$ALB_SG" \
  -var="certificate_arn=$CERT_ARN" \
  -var="environment=production"

# Apply configuration
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="public_subnet_ids=$PUBLIC_SUBNETS" \
  -var="alb_security_group_id=$ALB_SG" \
  -var="certificate_arn=$CERT_ARN" \
  -var="environment=production"
```

### Production with Access Logs

```bash
# Create S3 bucket for ALB logs first
aws s3 mb s3://transparent-trust-alb-logs-production

# Apply ALB with access logs
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="public_subnet_ids=$PUBLIC_SUBNETS" \
  -var="alb_security_group_id=$ALB_SG" \
  -var="certificate_arn=$CERT_ARN" \
  -var="enable_access_logs=true" \
  -var="access_logs_bucket=transparent-trust-alb-logs-production"
```

### Development (HTTP Only, No Certificate)

```bash
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="public_subnet_ids=$PUBLIC_SUBNETS" \
  -var="alb_security_group_id=$ALB_SG" \
  -var="environment=development" \
  -var="enable_https=false" \
  -var="enable_deletion_protection=false"
```

## Health Check Endpoint

Your Next.js application must expose a health check endpoint:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Optional: Check database connection, etc.
  return NextResponse.json({ status: 'healthy' }, { status: 200 });
}
```

## Route 53 Configuration

After deploying the ALB, create a Route 53 record:

```bash
# Get ALB DNS name and zone ID
ALB_DNS=$(terraform output -raw alb_dns_name)
ALB_ZONE=$(terraform output -raw alb_zone_id)

# Create Route 53 alias record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "app.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$ALB_ZONE'",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

## Integration with ECS

Use the target group ARN when creating your ECS service:

```hcl
# In infrastructure/ecs/main.tf
data "terraform_remote_state" "alb" {
  backend = "local"
  config = {
    path = "../alb/terraform.tfstate"
  }
}

resource "aws_ecs_service" "app" {
  # ... other config

  load_balancer {
    target_group_arn = data.terraform_remote_state.alb.outputs.target_group_arn
    container_name   = "app"
    container_port   = 3000
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.app_security_group_id]
  }
}
```

## Cost Estimates

Rough monthly costs for production (us-east-1):

| Component | Configuration | Est. Monthly Cost |
|-----------|---------------|-------------------|
| ALB | Standard ALB | ~$16.20 |
| LCU Usage | Low-moderate traffic | ~$5-10 |
| Data Processing | 1GB processed | ~$0.008/GB |
| **Total** | | **~$20-25/month** |

**Load Balancer Capacity Units (LCU)**:
- New connections/second
- Active connections (per minute)
- Processed bytes
- Rule evaluations

## Verification

### Check ALB Status

```bash
# List ALBs
aws elbv2 describe-load-balancers \
  --names transparent-trust-alb-production \
  --query 'LoadBalancers[0].[LoadBalancerName,State.Code,DNSName]' \
  --output table

# Check listeners
aws elbv2 describe-listeners \
  --load-balancer-arn $(terraform output -raw alb_arn) \
  --query 'Listeners[*].[Protocol,Port,DefaultActions[0].Type]' \
  --output table
```

### Check Target Group Health

```bash
# Check targets
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn) \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
  --output table
```

### Test HTTPS

```bash
# Test HTTPS endpoint
curl -I https://$(terraform output -raw alb_dns_name)

# Test HTTP redirect
curl -I http://$(terraform output -raw alb_dns_name)
# Should return 301 redirect to HTTPS
```

### View Access Logs

```bash
# Download recent logs
aws s3 sync s3://transparent-trust-alb-logs-production/alb-logs/ ./logs/ \
  --exclude "*" \
  --include "*$(date +%Y/%m/%d)*"

# View logs
gunzip -c logs/*.log.gz | less
```

## Troubleshooting

### Targets Show as Unhealthy

**Symptoms**: ECS tasks are running but marked unhealthy in target group

**Checks**:
```bash
# 1. Check health check configuration
aws elbv2 describe-target-groups \
  --target-group-arns $(terraform output -raw target_group_arn) \
  --query 'TargetGroups[0].HealthCheckPath'

# 2. Test health check endpoint directly
TASK_IP=$(aws ecs describe-tasks \
  --cluster <cluster-name> \
  --tasks <task-arn> \
  --query 'tasks[0].containers[0].networkInterfaces[0].privateIpv4Address' \
  --output text)

curl http://$TASK_IP:3000/api/health

# 3. Check security groups allow ALB → App traffic
# App security group must allow inbound from ALB security group on port 3000
```

### Certificate Validation Stuck

**Symptoms**: Certificate shows "Pending validation" status

**Solution**:
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions'

# Add DNS validation records to Route 53
# (or click validation link if using email validation)
```

### 502 Bad Gateway Errors

**Symptoms**: ALB returns 502 errors

**Common Causes**:
1. No healthy targets in target group
2. Application not listening on correct port
3. Health check endpoint returning non-200 status
4. Security groups blocking traffic

**Debugging**:
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# Check ALB logs for details
aws s3 cp s3://transparent-trust-alb-logs-production/alb-logs/latest.log.gz - | gunzip
```

### High Latency Alarm

**Symptoms**: Target response time > 2 seconds

**Investigation**:
```bash
# Check target response time metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=$(terraform output -raw alb_arn_suffix) \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check application logs for slow queries/operations
```

## Security Best Practices

### 1. HTTPS Only
- Always use HTTPS in production
- Redirect HTTP (80) to HTTPS (443)
- Use modern SSL policy (TLS 1.2+)

### 2. Certificate Management
- Use AWS Certificate Manager (free certificates)
- Enable auto-renewal
- Use wildcard certificates for multiple subdomains

### 3. Security Groups
- ALB security group: Allow 443 and 80 from 0.0.0.0/0
- App security group: Only allow traffic from ALB security group
- Never allow direct internet access to application

### 4. Access Logs
- Enable for production environments
- Useful for debugging and compliance
- Configure S3 lifecycle policies to manage costs

### 5. Deletion Protection
- Always enable in production
- Prevents accidental deletion
- Can be disabled when needed for teardown

## Monitoring

### CloudWatch Metrics

Key metrics to monitor:
- `ActiveConnectionCount`: Number of active connections
- `TargetResponseTime`: Application response time
- `HTTPCode_Target_2XX_Count`: Successful responses
- `HTTPCode_Target_5XX_Count`: Server errors
- `UnHealthyHostCount`: Number of unhealthy targets
- `RequestCount`: Total requests

### Alarms

This module creates alarms for:
1. **Unhealthy Targets**: Triggers when any target is unhealthy
2. **High 5xx Errors**: Triggers when > 10 errors in 2 minutes
3. **High Latency**: Triggers when average response time > 2 seconds

## Related Documentation

- [AWS_DEPLOYMENT.md](../../docs/AWS_DEPLOYMENT.md) - Full deployment guide
- [Phase 2.3 - Application Load Balancer](../../docs/AWS_DEPLOYMENT.md#23-application-load-balancer-sec-1052)
- [ALB Best Practices](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)
- [Target Group Health Checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)

## Support

For questions or issues:
- Linear: [SEC-1052](https://linear.app/montecarlodata/issue/SEC-1052)
- Repository: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
