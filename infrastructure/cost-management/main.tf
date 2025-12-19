# Cost Management Infrastructure for Transparent Trust
# Reference: SEC-1062 - Cost Management

# This module provides cost management and optimization capabilities including
# AWS Budgets for cost alerts, Cost Explorer for analysis, cost allocation tags,
# and automated cost reports.

# =========================================
# AWS Budgets
# =========================================

# Monthly budget with alerts
resource "aws_budgets_budget" "monthly" {
  count = var.enable_monthly_budget ? 1 : 0

  name              = "${var.project_name}-monthly-budget-${var.environment}"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_amount
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = var.budget_start_date

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:Project$${var.project_name}",
      "user:Environment$${var.environment}"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_alert_threshold_1
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = var.budget_alert_sns_topics
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_alert_threshold_2
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = var.budget_alert_sns_topics
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_alert_threshold_3
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = var.budget_alert_sns_topics
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_forecast_threshold
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = var.budget_alert_sns_topics
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-monthly-budget-${var.environment}"
    Environment = var.environment
  })
}

# Per-service budgets
resource "aws_budgets_budget" "per_service" {
  for_each = var.enable_per_service_budgets ? var.service_budgets : {}

  name              = "${var.project_name}-${each.key}-budget-${var.environment}"
  budget_type       = "COST"
  limit_amount      = each.value.amount
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = var.budget_start_date

  cost_filter {
    name   = "Service"
    values = [each.value.service_name]
  }

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:Project$${var.project_name}",
      "user:Environment$${var.environment}"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${each.key}-budget-${var.environment}"
    Environment = var.environment
    Service     = each.key
  })
}

# =========================================
# SNS Topic for Cost Alerts
# =========================================

resource "aws_sns_topic" "cost_alerts" {
  count = var.create_cost_alert_topic ? 1 : 0

  name         = "${var.project_name}-cost-alerts-${var.environment}"
  display_name = "Cost alerts for ${var.project_name} (${var.environment})"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cost-alerts-${var.environment}"
    Environment = var.environment
  })
}

# Email subscriptions for cost alerts
resource "aws_sns_topic_subscription" "cost_alert_emails" {
  for_each = var.create_cost_alert_topic ? toset(var.budget_alert_emails) : []

  topic_arn = aws_sns_topic.cost_alerts[0].arn
  protocol  = "email"
  endpoint  = each.value
}

# =========================================
# Cost Anomaly Detection
# =========================================

# Cost anomaly monitor
resource "aws_ce_anomaly_monitor" "main" {
  count = var.enable_anomaly_detection ? 1 : 0

  name              = "${var.project_name}-anomaly-monitor-${var.environment}"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-anomaly-monitor-${var.environment}"
    Environment = var.environment
  })
}

# Cost anomaly subscription
resource "aws_ce_anomaly_subscription" "main" {
  count = var.enable_anomaly_detection ? 1 : 0

  name      = "${var.project_name}-anomaly-subscription-${var.environment}"
  frequency = var.anomaly_detection_frequency

  monitor_arn_list = [
    aws_ce_anomaly_monitor.main[0].arn
  ]

  subscriber {
    type    = "EMAIL"
    address = var.anomaly_alert_email
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = [tostring(var.anomaly_threshold_amount)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-anomaly-subscription-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Cost Allocation Tags
# =========================================

# Activate cost allocation tags
resource "aws_ce_cost_category" "environment" {
  count = var.enable_cost_categories ? 1 : 0

  name         = "${var.project_name}-environment-category"
  rule_version = "CostCategoryExpression.v1"

  rule {
    value = "production"
    rule {
      dimension {
        key           = "ENVIRONMENT"
        values        = ["production", "prod"]
        match_options = ["EQUALS"]
      }
    }
  }

  rule {
    value = "staging"
    rule {
      dimension {
        key           = "ENVIRONMENT"
        values        = ["staging", "stage"]
        match_options = ["EQUALS"]
      }
    }
  }

  rule {
    value = "development"
    rule {
      dimension {
        key           = "ENVIRONMENT"
        values        = ["development", "dev"]
        match_options = ["EQUALS"]
      }
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-environment-category"
    Environment = var.environment
  })
}

# =========================================
# Savings Plans Recommendations
# =========================================

# Note: Savings Plans and Reserved Instances cannot be directly managed via Terraform
# They must be purchased through AWS Console or CLI after analyzing usage patterns.
# This module provides budget tracking and alerts to help identify opportunities.

# =========================================
# Cost Reports (via EventBridge + Lambda)
# =========================================

# S3 bucket for cost reports
resource "aws_s3_bucket" "cost_reports" {
  count = var.enable_automated_reports ? 1 : 0

  bucket = "${var.project_name}-cost-reports-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cost-reports-${var.environment}"
    Environment = var.environment
  })
}

# Enable encryption for cost reports bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "cost_reports" {
  count = var.enable_automated_reports ? 1 : 0

  bucket = aws_s3_bucket.cost_reports[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to cost reports
resource "aws_s3_bucket_public_access_block" "cost_reports" {
  count = var.enable_automated_reports ? 1 : 0

  bucket = aws_s3_bucket.cost_reports[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM role for cost report Lambda
resource "aws_iam_role" "cost_report_lambda" {
  count = var.enable_automated_reports ? 1 : 0

  name = "${var.project_name}-cost-report-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cost-report-lambda-${var.environment}"
    Environment = var.environment
  })
}

# IAM policy for cost report Lambda
resource "aws_iam_role_policy" "cost_report_lambda" {
  count = var.enable_automated_reports ? 1 : 0

  role = aws_iam_role.cost_report_lambda[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast",
          "ce:GetReservationUtilization",
          "ce:GetSavingsPlanUtilization",
          "ce:GetTags"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.cost_reports[0].arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-cost-report-*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = var.create_cost_alert_topic ? aws_sns_topic.cost_alerts[0].arn : ""
      }
    ]
  })
}

# EventBridge rule for daily cost reports
resource "aws_cloudwatch_event_rule" "daily_cost_report" {
  count = var.enable_automated_reports ? 1 : 0

  name                = "${var.project_name}-daily-cost-report-${var.environment}"
  description         = "Trigger daily cost report generation"
  schedule_expression = var.daily_report_schedule

  tags = merge(var.tags, {
    Name        = "${var.project_name}-daily-cost-report-${var.environment}"
    Environment = var.environment
  })
}

# EventBridge rule for weekly cost reports
resource "aws_cloudwatch_event_rule" "weekly_cost_report" {
  count = var.enable_automated_reports ? 1 : 0

  name                = "${var.project_name}-weekly-cost-report-${var.environment}"
  description         = "Trigger weekly cost report generation"
  schedule_expression = var.weekly_report_schedule

  tags = merge(var.tags, {
    Name        = "${var.project_name}-weekly-cost-report-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# CloudWatch Dashboard for Costs
# =========================================

resource "aws_cloudwatch_dashboard" "costs" {
  count = var.enable_cost_dashboard ? 1 : 0

  dashboard_name = "${var.project_name}-costs-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Billing", "EstimatedCharges", { stat = "Maximum", label = "Estimated Charges" }]
          ]
          view    = "timeSeries"
          region  = "us-east-1"
          title   = "Estimated Monthly Charges"
          period  = 86400
          yAxis = {
            left = { min = 0 }
          }
        }
        width  = 24
        height = 6
        x      = 0
        y      = 0
      }
    ]
  })
}

# =========================================
# Data Sources
# =========================================

data "aws_caller_identity" "current" {}
