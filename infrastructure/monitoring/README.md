# Monitoring Infrastructure for Transparent Trust

Comprehensive monitoring with CloudWatch dashboards, alarms, and SNS notifications for all infrastructure components.

**Reference**: [SEC-1058 - Monitoring & Logging](https://linear.app/montecarlodata/issue/SEC-1058)

## Overview

This module provides centralized monitoring including:
- **CloudWatch Dashboard**: Single pane of glass for all metrics
- **SNS Topics**: Critical and warning alert channels
- **CloudWatch Alarms**: Proactive monitoring for all components
- **Log Insights Queries**: Saved queries for common troubleshooting
- **Composite Alarms**: Multi-metric health checks

## Features

- Unified dashboard for ECS, RDS, Redis, and ALB
- Two-tier alerting (critical and warning)
- Email and Slack notifications
- Pre-configured alarms for common issues
- Log Insights queries for troubleshooting
- Composite alarms for overall health

## Components

1. **SNS Topics**: Critical and warning alert channels with email/Slack subscriptions
2. **CloudWatch Dashboard**: Visual metrics for all services
3. **Application Alarms**: High error rate, slow response times
4. **Database Alarms**: High CPU, high connections, low storage
5. **Log Insights Queries**: Error logs, slow requests
6. **Composite Alarms**: Overall service health

## Usage

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

## Alarms

### Application Alarms
- **High Error Rate**: >10 5XX errors in 5 minutes
- **High Response Time**: >2 seconds average for 15 minutes

### Database Alarms
- **High CPU**: >80% for 10 minutes
- **High Connections**: >80 connections for 10 minutes
- **Low Storage**: <5 GB free space

### Composite Alarms
- **Service Unhealthy**: Multiple metrics in alarm state

## Dashboard

The CloudWatch dashboard includes widgets for:
- ECS CPU and memory utilization
- RDS CPU and database connections
- Redis CPU and memory usage
- ALB response time, errors, and request count

View dashboard: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=transparent-trust-production`

## Notifications

### Email Setup
1. Add email addresses to `critical_alert_emails` and `warning_alert_emails`
2. Apply Terraform
3. Check email and confirm SNS subscription

### Slack Setup
1. Create incoming webhook in Slack
2. Set `slack_webhook_url_critical` and `slack_webhook_url_warning`
3. Apply Terraform

## Log Insights

Saved queries for common troubleshooting:
- **Error Logs**: Find all ERROR messages
- **Slow Requests**: Find requests >1 second

Access: CloudWatch → Logs → Insights → Saved queries

## Cost

Monitoring costs are minimal:
- Dashboards: Free (up to 3)
- Alarms: $0.10/alarm/month (~$1/month for 10 alarms)
- SNS: $0.50/1M requests (essentially free)
- Log Insights queries: $0.005/GB scanned

**Estimated**: ~$2-5/month

## Related Documentation

- [CloudWatch Dashboards](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [Log Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

## Support

For issues: [SEC-1058](https://linear.app/montecarlodata/issue/SEC-1058)
