# Cost Management Infrastructure for Transparent Trust

Complete cost management and optimization infrastructure with AWS Budgets for cost alerts, Cost Anomaly Detection, cost allocation tags, automated reports, and optimization recommendations.

**Reference**: [SEC-1062 - Cost Management](https://linear.app/montecarlodata/issue/SEC-1062)

## Overview

This module provides comprehensive cost management capabilities:
- **AWS Budgets**: Set monthly/per-service budgets with multi-threshold alerts
- **Cost Anomaly Detection**: ML-based detection of unusual spending patterns
- **Cost Allocation Tags**: Track costs by project, environment, team
- **Automated Reports**: Daily/weekly cost reports via EventBridge + Lambda
- **Cost Dashboard**: CloudWatch dashboard for billing metrics
- **Optimization Recommendations**: Built-in tips for reducing costs

## Quick Start

### Basic Setup (Monthly Budget + Anomaly Detection)

```hcl
module "cost_management" {
  source = "./infrastructure/cost-management"

  project_name = "transparent-trust"
  environment  = "production"

  # Monthly budget
  enable_monthly_budget = true
  monthly_budget_amount = "200"  # USD
  budget_start_date     = "2024-01-01"

  # Alert thresholds
  budget_alert_threshold_1 = 50   # Alert at 50%
  budget_alert_threshold_2 = 80   # Alert at 80%
  budget_alert_threshold_3 = 100  # Alert at 100%
  budget_forecast_threshold = 100 # Alert if forecasted to exceed

  # Alert recipients
  budget_alert_emails = [
    "finance@example.com",
    "engineering@example.com"
  ]

  # Anomaly detection
  enable_anomaly_detection     = true
  anomaly_detection_frequency  = "DAILY"
  anomaly_threshold_amount     = 10  # Alert if anomaly > $10
  anomaly_alert_email          = "finance@example.com"

  # Cost dashboard
  enable_cost_dashboard = true

  tags = {
    Project = "transparent-trust"
  }
}
```

### Advanced Setup (Per-Service Budgets + Automated Reports)

```hcl
module "cost_management" {
  source = "./infrastructure/cost-management"

  project_name = "transparent-trust"
  environment  = "production"

  # Monthly budget
  enable_monthly_budget = true
  monthly_budget_amount = "200"
  budget_alert_emails   = ["finance@example.com"]

  # Per-service budgets
  enable_per_service_budgets = true
  service_budgets = {
    ecs = {
      amount       = "60"
      service_name = "Amazon Elastic Compute Cloud - Compute"
    }
    rds = {
      amount       = "40"
      service_name = "Amazon Relational Database Service"
    }
    s3 = {
      amount       = "10"
      service_name = "Amazon Simple Storage Service"
    }
    networking = {
      amount       = "50"
      service_name = "Amazon EC2"
    }
  }

  # Anomaly detection
  enable_anomaly_detection = true
  anomaly_alert_email      = "finance@example.com"

  # Automated reports
  enable_automated_reports = true
  daily_report_schedule    = "cron(0 8 * * ? *)"  # 8 AM UTC daily
  weekly_report_schedule   = "cron(0 8 ? * MON *)" # 8 AM UTC Mondays

  # Cost categories
  enable_cost_categories = true

  tags = {
    Project = "transparent-trust"
  }
}
```

## Features

### AWS Budgets

**What it does**: Sets spending limits and sends alerts when thresholds are exceeded

**Key features**:
- Monthly total budget
- Per-service budgets (EC2, RDS, S3, etc.)
- Multi-threshold alerts (50%, 80%, 100%)
- Forecasted cost alerts
- Email and SNS notifications

**Alert thresholds**:
- **50%**: Early warning - time to review spending
- **80%**: Warning - investigate high-cost resources
- **100%**: Critical - budget exceeded, immediate action needed
- **Forecasted 100%**: Predicted to exceed - proactive alert

### Cost Anomaly Detection

**What it does**: Uses machine learning to detect unusual spending patterns

**Key features**:
- Service-level anomaly detection
- Customizable alert threshold
- Daily, immediate, or weekly notifications
- Historical comparison
- Root cause analysis

**Detects**:
- Sudden spikes in service costs
- New resources accidentally left running
- Misconfigured auto-scaling
- Data transfer anomalies
- Pricing changes

### Cost Allocation Tags

**What it does**: Tracks costs by project, environment, team, cost center

**Standard tags**:
- `Project`: transparent-trust
- `Environment`: production/staging/dev
- `Team`: engineering/security/data
- `CostCenter`: your cost center code

**Benefits**:
- Chargeback to teams/projects
- Cost attribution for multi-tenant
- Identify cost-heavy projects
- Budget by environment

### Automated Reports

**What it does**: Generates and emails cost reports automatically

**Report types**:
- **Daily**: Yesterday's costs by service
- **Weekly**: Last 7 days costs with trends
- **Monthly**: Month-to-date vs previous month

**Delivery**:
- Stored in S3 bucket
- Emailed via SNS
- Accessible via API

### Cost Dashboard

**What it does**: Visual representation of costs in CloudWatch

**Metrics shown**:
- Estimated monthly charges (updated daily)
- Cost trends over time
- Budget utilization
- Service breakdown

## Setup Steps

### 1. Apply Terraform

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

### 2. Confirm Email Subscriptions

Check your email for budget alert and anomaly detection confirmation emails. Click the confirmation links.

### 3. Enable Cost Explorer (One-time, Manual)

AWS Cost Explorer must be manually enabled once per account:

1. Visit: https://console.aws.amazon.com/cost-management/home#/dashboard
2. Click "Enable Cost Explorer"
3. Wait 24 hours for data to populate

### 4. Activate Cost Allocation Tags (Manual)

1. Visit: https://console.aws.amazon.com/billing/home#/tags
2. Activate these tags:
   - `Project`
   - `Environment`
   - `Team`
   - `CostCenter`
3. Wait 24 hours for costs to be tagged

### 5. View Current Costs

```bash
# Current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost

# Costs by service
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Forecast next month
aws ce get-cost-forecast \
  --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+30 days' +%Y-%m-%d) \
  --granularity MONTHLY \
  --metric BLENDED_COST
```

### 6. View Budget Status

```bash
# List all budgets
aws budgets describe-budgets \
  --account-id $(aws sts get-caller-identity --query Account --output text)

# Get specific budget
aws budgets describe-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget-name transparent-trust-monthly-budget-production
```

## Cost Optimization Strategies

### Compute Savings (Up to 72%)

**Strategy**: Use Savings Plans or Reserved Instances

```bash
# View Savings Plans recommendations
aws ce get-savings-plans-purchase-recommendation \
  --lookback-period-in-days 30 \
  --term ONE_YEAR \
  --payment-option NO_UPFRONT \
  --service-specification EC2

# View RI recommendations
aws ce get-reservation-purchase-recommendation \
  --service EC2 \
  --lookback-period-in-days 30 \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT
```

**Savings**:
- Compute Savings Plans: up to 66% savings
- EC2 Instance Savings Plans: up to 72% savings
- Reserved Instances: up to 69% (RDS), 72% (EC2)

**When to use**:
- Production workloads running 24/7
- After 3-6 months of steady usage patterns
- For predictable, consistent workloads

### Right-Sizing (Up to 40%)

**Strategy**: Match instance size to actual usage

```bash
# Get EC2 instance utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-1234567890abcdef0 \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average

# View right-sizing recommendations
aws ce get-rightsizing-recommendation \
  --service AmazonEC2
```

**Signs you need to right-size**:
- CPU < 40% consistently
- Memory < 60% consistently
- No traffic spikes observed

**Action**:
- Downsize to smaller instance type
- Switch to Graviton (ARM) for 20% savings

### Use Spot Instances (Up to 90%)

**Strategy**: Use Spot for non-critical, fault-tolerant workloads

**Good for**:
- Batch processing
- CI/CD builds
- Data processing
- Non-production environments

**Not good for**:
- Production databases
- User-facing applications
- Stateful workloads

### Storage Optimization (Up to 80%)

**Strategy**: Use appropriate storage classes

```hcl
# S3 lifecycle policy
resource "aws_s3_bucket_lifecycle_configuration" "intelligent" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "intelligent-tiering"
    status = "Enabled"

    transition {
      days          = 0
      storage_class = "INTELLIGENT_TIERING"
    }
  }

  rule {
    id     = "archive-old-data"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
```

**Savings**:
- Intelligent-Tiering: 68% savings for infrequent access
- Glacier: 84% savings for archives
- Delete unused snapshots/volumes: 100% savings

### Networking Savings (Up to 60%)

**Strategy**: Optimize data transfer

**Quick wins**:
- Use VPC endpoints instead of NAT Gateway: save $35/month per NAT
- Use single NAT for non-prod: save $35/month
- Use CloudFront for static content: reduce origin requests
- Enable S3 Transfer Acceleration only when needed: save $0.04 per GB

```hcl
# VPC endpoints save NAT Gateway costs
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.us-east-1.s3"
}
```

## Cost Breakdown

### Baseline Infrastructure (Minimal)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| Amplify | Hosting + builds | $5-15 |
| RDS | db.t3.micro, Single-AZ | $15 |
| S3 | 50GB storage | $1.50 |
| Secrets Manager | 5 secrets | $2 |
| CloudWatch | Basic logs/metrics | $5 |
| Route 53 | 1 hosted zone | $0.50 |
| **Total** | | **~$29-39/month** |

### Standard Infrastructure (Recommended)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate | 1 task, 1 vCPU, 2GB | $30 |
| RDS | db.t3.small, Multi-AZ | $40 |
| Redis | Upstash free tier | $0 |
| S3 | 100GB storage | $3 |
| ALB | Standard usage | $20 |
| NAT Gateway | 10GB transfer | $35 |
| Secrets Manager | 10 secrets | $4 |
| CloudWatch | Standard logs | $10 |
| CloudTrail | Audit logging | $2 |
| Config | 6 rules | $14 |
| GuardDuty | Threat detection | $5 |
| Route 53 | 1 hosted zone | $0.50 |
| **Total** | | **~$163.50/month** |

### Optimized Infrastructure

| Optimization | Savings |
|-------------|---------|
| Use Amplify instead of ECS | -$25/month |
| Single-AZ RDS in dev | -$15/month |
| Upstash instead of ElastiCache | -$12/month |
| Remove NAT, use VPC endpoints | -$35/month |
| S3 Intelligent-Tiering | -$1/month |
| **Total Savings** | **-$88/month** |
| **Optimized Total** | **~$75/month** |

## Monitoring and Alerts

### Budget Alerts

You'll receive emails when:
1. **50% of budget**: "You've spent $100 of $200 budget"
2. **80% of budget**: "You've spent $160 of $200 budget"
3. **100% of budget**: "You've exceeded your $200 budget"
4. **Forecasted 100%**: "You're projected to exceed your $200 budget"

### Anomaly Alerts

You'll receive emails when:
- Service costs spike unexpectedly
- New resources appear
- Usage patterns change significantly
- Costs exceed $10 threshold (configurable)

### Cost Dashboard

View real-time costs:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=transparent-trust-costs-production
```

## Troubleshooting

### Budget alerts not working

**Issue**: Not receiving budget alert emails

**Solution**:
1. Check spam folder
2. Verify email subscriptions:
   ```bash
   aws sns list-subscriptions
   ```
3. Confirm subscriptions by clicking email links
4. Verify budget is active:
   ```bash
   aws budgets describe-budget --account-id ACCOUNT_ID --budget-name BUDGET_NAME
   ```

### Cost Explorer not showing data

**Issue**: Cost Explorer is empty

**Solution**:
1. Ensure Cost Explorer is enabled (manual, one-time)
2. Wait 24 hours after enabling
3. Check that resources have cost allocation tags
4. Verify tags are activated in Billing console

### Anomaly detection not working

**Issue**: No anomaly alerts despite unusual costs

**Solution**:
1. Verify anomaly detection is enabled
2. Check threshold isn't too high
3. Wait 24 hours for baseline to establish
4. Confirm email subscription

### Costs higher than expected

**Issue**: Monthly costs exceed budget

**Solution**:
1. Review Cost Explorer by service:
   ```bash
   aws ce get-cost-and-usage \
     --time-period Start=YYYY-MM-01,End=YYYY-MM-DD \
     --granularity DAILY \
     --metrics BlendedCost \
     --group-by Type=DIMENSION,Key=SERVICE
   ```
2. Check for:
   - NAT Gateway data transfer (common cost driver)
   - Unused EIPs ($0.005/hour = $3.60/month each)
   - Unattached EBS volumes
   - Old RDS snapshots
   - S3 storage in Standard class (should be Intelligent-Tiering)
3. Use AWS Cost Anomaly Detection to identify spikes
4. Review right-sizing recommendations

## Best Practices

1. **Set budgets for every environment** - Production, staging, dev
2. **Tag everything** - Project, Environment, Team, CostCenter
3. **Review costs weekly** - Don't wait for month-end surprises
4. **Enable anomaly detection** - Catch issues early
5. **Use Cost Explorer regularly** - Understand spending patterns
6. **Right-size after 30 days** - Adjust based on actual usage
7. **Delete unused resources** - EIPs, volumes, snapshots
8. **Use Savings Plans** - After establishing usage patterns (3-6 months)
9. **Automate cost reports** - Share with team weekly
10. **Document optimizations** - Track savings over time

## Related Documentation

- [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)
- [Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html)
- [Cost Allocation Tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html)
- [Savings Plans](https://docs.aws.amazon.com/savingsplans/)

## Support

For issues: [SEC-1062](https://linear.app/montecarlodata/issue/SEC-1062)
