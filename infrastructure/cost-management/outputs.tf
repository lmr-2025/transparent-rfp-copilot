# Outputs for Cost Management Infrastructure
# Reference: SEC-1062

# =========================================
# Budget Outputs
# =========================================

output "monthly_budget_name" {
  description = "Name of the monthly budget"
  value       = var.enable_monthly_budget ? aws_budgets_budget.monthly[0].name : null
}

output "monthly_budget_amount" {
  description = "Monthly budget amount in USD"
  value       = var.monthly_budget_amount
}

output "service_budgets" {
  description = "Map of per-service budget names"
  value       = var.enable_per_service_budgets ? { for k, v in aws_budgets_budget.per_service : k => v.name } : {}
}

# =========================================
# SNS Topic Outputs
# =========================================

output "cost_alert_topic_arn" {
  description = "ARN of the cost alert SNS topic"
  value       = var.create_cost_alert_topic ? aws_sns_topic.cost_alerts[0].arn : null
}

output "cost_alert_topic_name" {
  description = "Name of the cost alert SNS topic"
  value       = var.create_cost_alert_topic ? aws_sns_topic.cost_alerts[0].name : null
}

# =========================================
# Anomaly Detection Outputs
# =========================================

output "anomaly_monitor_arn" {
  description = "ARN of the cost anomaly monitor"
  value       = var.enable_anomaly_detection ? aws_ce_anomaly_monitor.main[0].arn : null
}

output "anomaly_subscription_arn" {
  description = "ARN of the cost anomaly subscription"
  value       = var.enable_anomaly_detection ? aws_ce_anomaly_subscription.main[0].arn : null
}

# =========================================
# Cost Reports Outputs
# =========================================

output "cost_reports_bucket_name" {
  description = "Name of the S3 bucket for cost reports"
  value       = var.enable_automated_reports ? aws_s3_bucket.cost_reports[0].id : null
}

output "cost_reports_bucket_arn" {
  description = "ARN of the S3 bucket for cost reports"
  value       = var.enable_automated_reports ? aws_s3_bucket.cost_reports[0].arn : null
}

# =========================================
# Dashboard Outputs
# =========================================

output "cost_dashboard_url" {
  description = "URL to view the cost dashboard"
  value       = var.enable_cost_dashboard ? "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.costs[0].dashboard_name}" : null
}

# =========================================
# Setup Instructions
# =========================================

output "setup_instructions" {
  description = "Next steps for cost management setup"
  value = <<-EOT
    ========================================
    COST MANAGEMENT SETUP INSTRUCTIONS
    ========================================

    ${var.enable_monthly_budget ? "✅ Monthly Budget: $${var.monthly_budget_amount}/month" : "❌ Monthly Budget: Disabled"}
    ${var.enable_anomaly_detection ? "✅ Anomaly Detection: Enabled" : "❌ Anomaly Detection: Disabled"}
    ${var.enable_cost_dashboard ? "✅ Cost Dashboard: Enabled" : "❌ Cost Dashboard: Disabled"}

    Budget Alerts Configured:
    - ${var.budget_alert_threshold_1}% of budget ($${parseint(var.monthly_budget_amount, 10) * var.budget_alert_threshold_1 / 100})
    - ${var.budget_alert_threshold_2}% of budget ($${parseint(var.monthly_budget_amount, 10) * var.budget_alert_threshold_2 / 100})
    - ${var.budget_alert_threshold_3}% of budget ($${parseint(var.monthly_budget_amount, 10) * var.budget_alert_threshold_3 / 100})
    - Forecasted to exceed budget

    ${length(var.budget_alert_emails) > 0 ? "\nAlert Recipients:\n${join("\n", formatlist("- %s", var.budget_alert_emails))}" : "\n⚠️  No alert recipients configured!"}

    Next Steps:

    1. View Current Costs:
       aws ce get-cost-and-usage \
         --time-period Start=2024-01-01,End=2024-01-31 \
         --granularity MONTHLY \
         --metrics BlendedCost

    2. View Budget Status:
       aws budgets describe-budgets --account-id ${data.aws_caller_identity.current.account_id}

    ${var.enable_cost_dashboard ? "\n3. View Cost Dashboard:\n   ${var.enable_cost_dashboard ? "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.costs[0].dashboard_name}" : "N/A"}" : ""}

    4. Enable Cost Explorer (one-time, manual):
       https://console.aws.amazon.com/cost-management/home#/dashboard

    5. Review Savings Opportunities:
       - Compute Savings Plans: https://console.aws.amazon.com/cost-management/home#/savings-plans/recommendations
       - Reserved Instances: https://console.aws.amazon.com/cost-management/home#/ri/recommendations

    6. Set up cost allocation tags (in AWS Console):
       - Project: ${var.project_name}
       - Environment: ${var.environment}
       - Team: [your-team]
       - CostCenter: [your-cost-center]

    ========================================
  EOT
}

# =========================================
# Cost Optimization Tips
# =========================================

output "cost_optimization_tips" {
  description = "Cost optimization recommendations"
  value = {
    compute = [
      "Use Graviton instances (AWS ARM) for 20% cost savings",
      "Consider Savings Plans for predictable workloads (up to 72% savings)",
      "Use Spot Instances for non-critical workloads (up to 90% savings)",
      "Right-size EC2/ECS instances based on CloudWatch metrics"
    ]
    database = [
      "Use Aurora Serverless for variable workloads",
      "Consider Reserved Instances for RDS (up to 69% savings)",
      "Use read replicas instead of Multi-AZ for read-heavy workloads",
      "Enable automated backups with lifecycle policies"
    ]
    storage = [
      "Use S3 Intelligent-Tiering for automatic cost optimization",
      "Set lifecycle policies to move old data to Glacier",
      "Enable S3 Transfer Acceleration only when needed",
      "Delete unused EBS snapshots and volumes"
    ]
    networking = [
      "Use VPC endpoints to avoid NAT Gateway charges",
      "Consider single NAT Gateway for non-production",
      "Use CloudFront for static content to reduce data transfer",
      "Optimize ALB by consolidating target groups"
    ]
    general = [
      "Delete unused resources (EIPs, load balancers, volumes)",
      "Use tags to track and allocate costs",
      "Set up billing alerts at 50%, 80%, 100%",
      "Review Cost Explorer monthly for trends",
      "Consider AWS Enterprise Support for TAM cost optimization reviews"
    ]
  }
}

# =========================================
# Cost Estimate by Service
# =========================================

output "estimated_monthly_costs" {
  description = "Estimated monthly costs by service (example workload)"
  value = {
    compute = {
      ecs_fargate        = "$30-50 (1-2 tasks, 1 vCPU, 2GB RAM)"
      amplify_alternative = "$5-30 (build minutes + hosting)"
    }
    database = {
      rds_multi_az = "$30-60 (db.t3.micro to db.t3.small)"
      rds_single_az = "$15-30 (50% savings vs Multi-AZ)"
    }
    cache = {
      elasticache = "$12-30 (cache.t3.micro to cache.t3.small)"
      upstash      = "$0 (free tier)"
    }
    storage = {
      s3              = "$3-10 (100GB storage + requests)"
      cloudtrail_logs = "$0.50-2 (30-90 days retention)"
      config_logs     = "$0.50-2 (30-90 days retention)"
    }
    networking = {
      alb         = "$20-25 (standard usage)"
      nat_gateway = "$35-50 (1 GB data transfer)"
      route53     = "$0.50-1 (1-2 hosted zones)"
      cloudfront  = "$1-5 (optional, usage-based)"
    }
    management = {
      secrets_manager = "$4-8 (10-20 secrets)"
      cloudwatch      = "$5-15 (logs + metrics + alarms)"
      guardduty       = "$5-10 (threat detection)"
      config          = "$14-20 (recorder + 6 rules)"
    }
    cicd = {
      ecr              = "$0.10 per GB (image storage)"
      github_actions   = "$0 (2000 free minutes)"
      codepipeline     = "$1-5 (if using instead of GitHub Actions)"
    }
    total_minimum = {
      with_fargate  = "$130-200/month (full stack with ECS)"
      with_amplify  = "$100-150/month (full stack with Amplify)"
      optimized     = "$80-120/month (using free tiers + single AZ + Upstash)"
    }
  }
}

# =========================================
# Testing Commands
# =========================================

output "testing_commands" {
  description = "Commands to test cost management setup"
  value = {
    view_current_costs  = "aws ce get-cost-and-usage --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) --granularity MONTHLY --metrics BlendedCost"
    view_budgets        = "aws budgets describe-budgets --account-id ${data.aws_caller_identity.current.account_id}"
    view_budget_details = var.enable_monthly_budget ? "aws budgets describe-budget --account-id ${data.aws_caller_identity.current.account_id} --budget-name ${aws_budgets_budget.monthly[0].name}" : "Monthly budget disabled"
    view_anomalies      = var.enable_anomaly_detection ? "aws ce get-anomalies --date-interval Start=2024-01-01,End=2024-12-31 --monitor-arn ${aws_ce_anomaly_monitor.main[0].arn}" : "Anomaly detection disabled"
    forecast_costs      = "aws ce get-cost-forecast --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+30 days' +%Y-%m-%d) --granularity MONTHLY --metric BLENDED_COST"
    view_by_service     = "aws ce get-cost-and-usage --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) --granularity MONTHLY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE"
    view_by_tag         = "aws ce get-cost-and-usage --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) --granularity MONTHLY --metrics BlendedCost --group-by Type=TAG,Key=Project"
  }
}

# =========================================
# Data Sources
# =========================================

data "aws_caller_identity" "current" {}
