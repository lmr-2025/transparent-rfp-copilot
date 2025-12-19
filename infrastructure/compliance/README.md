# Compliance & Governance Infrastructure for Transparent Trust

Complete compliance and governance infrastructure with CloudTrail audit logging, AWS Config compliance monitoring, GuardDuty threat detection, and Security Hub centralized security management.

**Reference**: [SEC-1061 - Compliance & Governance](https://linear.app/montecarlodata/issue/SEC-1061)

## Overview

This module provides enterprise-grade compliance and governance capabilities:
- **CloudTrail**: Complete audit trail of AWS API calls
- **AWS Config**: Continuous compliance monitoring and resource tracking
- **GuardDuty**: Intelligent threat detection using machine learning
- **Security Hub**: Centralized security findings and compliance dashboards

## Architecture

```
CloudTrail → S3 Bucket (encrypted, lifecycle policies)
           → CloudWatch Logs (real-time monitoring)

AWS Config → S3 Bucket (compliance snapshots)
           → Config Rules (automated compliance checks)

GuardDuty → EventBridge → SNS → Email/Slack notifications

Security Hub → Aggregate findings from CloudTrail, Config, GuardDuty
```

## Quick Start

### Basic Setup (CloudTrail + Config + GuardDuty)

```hcl
module "compliance" {
  source = "./infrastructure/compliance"

  project_name = "transparent-trust"
  environment  = "production"

  # CloudTrail - Audit logging
  enable_cloudtrail         = true
  cloudtrail_multi_region   = true
  cloudtrail_cloudwatch_logs = true

  # AWS Config - Compliance monitoring
  enable_config       = true
  enable_config_rules = true

  # GuardDuty - Threat detection
  enable_guardduty               = true
  guardduty_notification_enabled = true
  guardduty_notification_emails  = ["security@example.com"]

  # Security Hub - Optional
  enable_security_hub = false

  tags = {
    Project    = "transparent-trust"
    Compliance = "required"
  }
}
```

### Advanced Setup (All Features)

```hcl
module "compliance" {
  source = "./infrastructure/compliance"

  project_name = "transparent-trust"
  environment  = "production"

  # CloudTrail with advanced features
  enable_cloudtrail              = true
  cloudtrail_multi_region        = true
  cloudtrail_s3_data_events      = true  # Log S3 read/write
  cloudtrail_lambda_data_events  = true  # Log Lambda invocations
  cloudtrail_enable_insights     = true  # Anomaly detection
  cloudtrail_cloudwatch_logs     = true

  # Log retention
  cloudtrail_log_retention_days = 90
  cloudtrail_expiration_days    = 365

  # AWS Config with all rules
  enable_config                     = true
  enable_config_rules               = true
  config_include_global_resources   = true

  # GuardDuty with all protections
  enable_guardduty                  = true
  guardduty_finding_frequency       = "FIFTEEN_MINUTES"
  guardduty_s3_logs                 = true
  guardduty_malware_protection      = true
  guardduty_notification_enabled    = true
  guardduty_notification_emails     = ["security@example.com", "oncall@example.com"]

  # Security Hub with all standards
  enable_security_hub                      = true
  security_hub_enable_aws_foundational     = true
  security_hub_enable_cis                  = true
  security_hub_enable_pci_dss              = true

  tags = {
    Project    = "transparent-trust"
    Compliance = "required"
  }
}
```

## Features

### CloudTrail

**What it does**: Records every AWS API call made in your account

**Key features**:
- Multi-region trail (captures events from all regions)
- Log file validation (integrity checking)
- CloudWatch Logs integration (real-time alerts)
- S3 data events (log S3 object-level operations)
- Lambda data events (log function invocations)
- CloudTrail Insights (anomaly detection)

**Use cases**:
- Security investigations ("Who deleted this S3 bucket?")
- Compliance audits (SOC 2, HIPAA, PCI DSS)
- Change tracking ("What changes were made yesterday?")
- Troubleshooting ("Why did this deployment fail?")

### AWS Config

**What it does**: Continuously monitors and records AWS resource configurations

**Key features**:
- Resource inventory (what resources exist)
- Configuration history (how resources changed over time)
- Compliance rules (automated checks)
- Relationship tracking (how resources relate)

**Built-in rules**:
1. **S3 bucket encryption**: Ensures all S3 buckets have encryption enabled
2. **RDS encryption**: Ensures RDS instances have encryption at rest
3. **Security group SSH**: Detects unrestricted SSH access (0.0.0.0/0)
4. **IAM password policy**: Enforces strong password requirements
5. **Root MFA**: Ensures root account has MFA enabled
6. **CloudTrail enabled**: Verifies CloudTrail is active

**Use cases**:
- Compliance reporting ("Are all S3 buckets encrypted?")
- Change management ("Show me all security group changes")
- Resource tracking ("List all RDS instances")
- Audit preparation (automated compliance checks)

### GuardDuty

**What it does**: Intelligent threat detection using machine learning

**Key features**:
- Analyzes CloudTrail, VPC Flow Logs, DNS logs
- S3 protection (detects suspicious S3 access)
- Machine learning-based anomaly detection
- Threat intelligence feeds
- Real-time notifications

**Detects**:
- Compromised EC2 instances
- Unauthorized API calls
- Cryptocurrency mining
- Port scanning
- Malware
- Data exfiltration
- Reconnaissance activities

**Use cases**:
- Security monitoring ("Are there any active threats?")
- Incident response ("What triggered this alert?")
- Compliance (threat detection requirement)

### Security Hub

**What it does**: Centralized security and compliance dashboard

**Key features**:
- Aggregates findings from CloudTrail, Config, GuardDuty
- Security standards (AWS Foundational, CIS, PCI DSS)
- Compliance scoring
- Automated checks
- Prioritized findings

**Standards**:
1. **AWS Foundational Security Best Practices**: 43 checks
2. **CIS AWS Foundations Benchmark**: 58 checks
3. **PCI DSS**: 48 checks (if enabled)

**Use cases**:
- Executive dashboard ("What's our security posture?")
- Compliance reporting ("Are we PCI DSS compliant?")
- Prioritization ("What should we fix first?")

## Configuration Options

### CloudTrail

| Variable | Description | Default | Cost Impact |
|----------|-------------|---------|-------------|
| `enable_cloudtrail` | Enable CloudTrail | `true` | +$2/month |
| `cloudtrail_multi_region` | Log all regions | `true` | No cost |
| `cloudtrail_s3_data_events` | Log S3 operations | `false` | +$0.10 per 100K events |
| `cloudtrail_lambda_data_events` | Log Lambda invocations | `false` | +$0.10 per 100K events |
| `cloudtrail_enable_insights` | Anomaly detection | `false` | +$0.35 per 100K events |
| `cloudtrail_cloudwatch_logs` | Send to CloudWatch | `true` | +$0.50 per GB |

### AWS Config

| Variable | Description | Default | Cost Impact |
|----------|-------------|---------|-------------|
| `enable_config` | Enable AWS Config | `true` | +$2/month |
| `enable_config_rules` | Enable compliance rules | `true` | +$2 per rule |
| `config_include_global_resources` | Include IAM, etc | `true` | No cost |

### GuardDuty

| Variable | Description | Default | Cost Impact |
|----------|-------------|---------|-------------|
| `enable_guardduty` | Enable GuardDuty | `true` | ~$4.50 per million events |
| `guardduty_finding_frequency` | Notification frequency | `FIFTEEN_MINUTES` | No cost |
| `guardduty_s3_logs` | S3 protection | `true` | +$0.80 per GB analyzed |
| `guardduty_malware_protection` | EC2 malware scanning | `false` | +$0.65 per GB scanned |

### Security Hub

| Variable | Description | Default | Cost Impact |
|----------|-------------|---------|-------------|
| `enable_security_hub` | Enable Security Hub | `false` | ~$0.0010 per check |
| `security_hub_enable_aws_foundational` | AWS Foundational | `true` | ~$10/month |
| `security_hub_enable_cis` | CIS Benchmark | `true` | ~$15/month |
| `security_hub_enable_pci_dss` | PCI DSS | `false` | ~$12/month |

## Setup Steps

### 1. Apply Terraform

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

### 2. Confirm SNS Subscriptions

Check your email for GuardDuty notification subscriptions and click the confirmation links.

### 3. View CloudTrail Logs

```bash
# List recent events
aws cloudtrail lookup-events --max-results 10

# Search for specific user
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=admin \
  --max-results 20

# Check trail status
aws cloudtrail get-trail-status --name transparent-trust-trail-production
```

### 4. Check AWS Config Compliance

```bash
# View overall compliance
aws configservice describe-compliance-by-config-rule

# Check specific resource
aws configservice describe-compliance-by-resource \
  --resource-type AWS::S3::Bucket

# Get compliance details
aws configservice get-compliance-details-by-config-rule \
  --config-rule-name transparent-trust-s3-encryption-production
```

### 5. Review GuardDuty Findings

```bash
# List all findings
aws guardduty list-findings \
  --detector-id $(terraform output -raw guardduty_detector_id)

# Get finding details
aws guardduty get-findings \
  --detector-id $(terraform output -raw guardduty_detector_id) \
  --finding-ids FINDING_ID

# Get statistics
aws guardduty get-findings-statistics \
  --detector-id $(terraform output -raw guardduty_detector_id) \
  --finding-statistic-types COUNT_BY_SEVERITY
```

### 6. Access Security Hub (if enabled)

Visit: https://console.aws.amazon.com/securityhub/home?region=us-east-1#/summary

Or use CLI:
```bash
# Get security score
aws securityhub get-findings \
  --filters '{"ComplianceStatus":[{"Value":"FAILED","Comparison":"EQUALS"}]}' \
  --max-results 10
```

## Cost Breakdown

### Minimal Setup (CloudTrail + Config + GuardDuty)
| Service | Cost |
|---------|------|
| CloudTrail | $2/month (management events) |
| CloudTrail S3 storage | ~$0.50/month (30 days of logs) |
| AWS Config | $2/month (recorder) |
| AWS Config Rules | $12/month (6 rules × $2) |
| GuardDuty | ~$5-10/month (varies by activity) |
| **Total** | **~$22-27/month** |

### Full Setup (All Features)
| Service | Cost |
|---------|------|
| CloudTrail with data events | $5-10/month |
| CloudTrail Insights | +$0.35 per 100K events |
| AWS Config | $2/month |
| AWS Config Rules | $12/month |
| GuardDuty with S3 protection | $10-20/month |
| Security Hub (all standards) | $30-40/month |
| **Total** | **~$60-85/month** |

**Note**: Actual costs vary based on:
- Number of AWS API calls
- Amount of S3 data accessed
- Number of resources monitored
- GuardDuty findings volume

## Monitoring and Alerts

### CloudWatch Alarms

Create alarms for critical events:

```hcl
# Alarm for unauthorized API calls
resource "aws_cloudwatch_metric_alarm" "unauthorized_api_calls" {
  alarm_name          = "unauthorized-api-calls"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnauthorizedAPICalls"
  namespace           = "CloudTrailMetrics"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
}

# Alarm for root account usage
resource "aws_cloudwatch_metric_alarm" "root_account_usage" {
  alarm_name          = "root-account-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RootAccountUsage"
  namespace           = "CloudTrailMetrics"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
}
```

### GuardDuty Notifications

GuardDuty findings with severity ≥ 4.0 (Medium, High, Critical) automatically trigger SNS notifications.

**Severity levels**:
- **Low** (1-3.9): Informational
- **Medium** (4-6.9): Suspicious activity
- **High** (7-8.9): Likely malicious
- **Critical** (9-10): Confirmed threat

## Troubleshooting

### CloudTrail: "Trail not logging"

**Issue**: CloudTrail status shows not logging

**Solution**:
```bash
# Check trail status
aws cloudtrail get-trail-status --name transparent-trust-trail-production

# Verify S3 bucket policy
aws s3api get-bucket-policy --bucket BUCKET_NAME

# Start logging if stopped
aws cloudtrail start-logging --name transparent-trust-trail-production
```

### Config: "Recorder not active"

**Issue**: Config recorder shows as stopped

**Solution**:
```bash
# Check recorder status
aws configservice describe-configuration-recorder-status

# Start recorder
aws configservice start-configuration-recorder \
  --configuration-recorder-name transparent-trust-config-recorder-production
```

### GuardDuty: "No findings"

**Issue**: GuardDuty enabled but no findings showing

**This is normal!** GuardDuty only generates findings when threats are detected. No findings = good security posture.

To test GuardDuty:
```bash
# Generate sample findings
aws guardduty create-sample-findings \
  --detector-id $(terraform output -raw guardduty_detector_id) \
  --finding-types Backdoor:EC2/DenialOfService.Tcp
```

### Config Rules: "Non-compliant resources"

**Issue**: Resources showing as non-compliant

**Solution**:
1. Review the non-compliant resources:
   ```bash
   aws configservice describe-compliance-by-config-rule \
     --config-rule-names transparent-trust-s3-encryption-production
   ```

2. Fix the resources (e.g., enable S3 encryption):
   ```bash
   aws s3api put-bucket-encryption \
     --bucket BUCKET_NAME \
     --server-side-encryption-configuration '{
       "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
     }'
   ```

3. Trigger re-evaluation:
   ```bash
   aws configservice start-config-rules-evaluation \
     --config-rule-names transparent-trust-s3-encryption-production
   ```

## Security Best Practices

1. **Enable multi-region CloudTrail** - Capture all API calls
2. **Enable log file validation** - Detect tampered logs
3. **Encrypt S3 buckets** - Protect logs at rest
4. **Set log retention** - Meet compliance requirements
5. **Enable GuardDuty** - Detect threats early
6. **Review findings weekly** - Stay on top of security
7. **Automate remediation** - Use Lambda for common fixes
8. **Test incident response** - Practice responding to findings
9. **Document compliance** - Keep audit trail documentation
10. **Regular compliance audits** - Review Config compliance monthly

## Compliance Frameworks

### SOC 2 Type II

**Requirements met**:
- CC6.1: Logical access - GuardDuty detects unauthorized access
- CC6.2: Authorization - CloudTrail logs all access
- CC6.3: Network security - Config monitors security groups
- CC7.2: System monitoring - CloudWatch + GuardDuty
- CC7.3: Malicious software - GuardDuty malware detection

### HIPAA

**Requirements met**:
- §164.308(a)(1)(ii)(D): Information system activity review - CloudTrail
- §164.308(a)(5)(ii)(C): Log-in monitoring - CloudTrail + GuardDuty
- §164.312(b): Audit controls - CloudTrail + Config
- §164.312(d): Person or entity authentication - IAM + CloudTrail

### PCI DSS

**Requirements met**:
- Requirement 10: Track and monitor all access - CloudTrail
- Requirement 10.2: Implement automated audit trails - CloudTrail + Config
- Requirement 10.3: Record audit trail entries - CloudTrail logs
- Requirement 11.4: Use intrusion-detection systems - GuardDuty

## Related Documentation

- [AWS CloudTrail](https://docs.aws.amazon.com/cloudtrail/)
- [AWS Config](https://docs.aws.amazon.com/config/)
- [Amazon GuardDuty](https://docs.aws.amazon.com/guardduty/)
- [AWS Security Hub](https://docs.aws.amazon.com/securityhub/)
- [Compliance Resources](https://aws.amazon.com/compliance/)

## Support

For issues: [SEC-1061](https://linear.app/montecarlodata/issue/SEC-1061)
