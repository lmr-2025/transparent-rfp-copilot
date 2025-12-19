# Variables for Cost Management Infrastructure
# Reference: SEC-1062

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Name of the project (used in resource naming)"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, dev)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# =========================================
# Budget Configuration
# =========================================

variable "enable_monthly_budget" {
  description = "Enable monthly budget with alerts"
  type        = bool
  default     = true
}

variable "monthly_budget_amount" {
  description = "Monthly budget limit in USD"
  type        = string
  default     = "200"
}

variable "budget_start_date" {
  description = "Budget start date (YYYY-MM-01 format)"
  type        = string
  default     = "2024-01-01"
}

variable "budget_alert_threshold_1" {
  description = "First budget alert threshold (percentage)"
  type        = number
  default     = 50
}

variable "budget_alert_threshold_2" {
  description = "Second budget alert threshold (percentage)"
  type        = number
  default     = 80
}

variable "budget_alert_threshold_3" {
  description = "Third budget alert threshold (percentage)"
  type        = number
  default     = 100
}

variable "budget_forecast_threshold" {
  description = "Forecasted budget alert threshold (percentage)"
  type        = number
  default     = 100
}

variable "budget_alert_emails" {
  description = "Email addresses to receive budget alerts"
  type        = list(string)
  default     = []
}

variable "budget_alert_sns_topics" {
  description = "SNS topic ARNs for budget alerts"
  type        = list(string)
  default     = []
}

# =========================================
# Per-Service Budgets
# =========================================

variable "enable_per_service_budgets" {
  description = "Enable per-service budgets"
  type        = bool
  default     = false
}

variable "service_budgets" {
  description = "Per-service budget configuration"
  type = map(object({
    amount       = string
    service_name = string
  }))
  default = {
    ec2 = {
      amount       = "50"
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
  }
}

# =========================================
# Cost Alert Configuration
# =========================================

variable "create_cost_alert_topic" {
  description = "Create SNS topic for cost alerts"
  type        = bool
  default     = true
}

# =========================================
# Anomaly Detection Configuration
# =========================================

variable "enable_anomaly_detection" {
  description = "Enable AWS Cost Anomaly Detection"
  type        = bool
  default     = true
}

variable "anomaly_detection_frequency" {
  description = "Frequency of anomaly detection reports (DAILY, IMMEDIATE, WEEKLY)"
  type        = string
  default     = "DAILY"
  validation {
    condition     = contains(["DAILY", "IMMEDIATE", "WEEKLY"], var.anomaly_detection_frequency)
    error_message = "Anomaly detection frequency must be DAILY, IMMEDIATE, or WEEKLY"
  }
}

variable "anomaly_threshold_amount" {
  description = "Minimum dollar amount for anomaly alerts"
  type        = number
  default     = 10
}

variable "anomaly_alert_email" {
  description = "Email address for anomaly alerts"
  type        = string
  default     = ""
}

# =========================================
# Cost Categories Configuration
# =========================================

variable "enable_cost_categories" {
  description = "Enable AWS Cost Categories"
  type        = bool
  default     = false
}

# =========================================
# Automated Reports Configuration
# =========================================

variable "enable_automated_reports" {
  description = "Enable automated cost reports"
  type        = bool
  default     = false
}

variable "daily_report_schedule" {
  description = "Cron expression for daily cost reports"
  type        = string
  default     = "cron(0 8 * * ? *)" # 8 AM UTC daily
}

variable "weekly_report_schedule" {
  description = "Cron expression for weekly cost reports"
  type        = string
  default     = "cron(0 8 ? * MON *)" # 8 AM UTC every Monday
}

# =========================================
# Cost Dashboard Configuration
# =========================================

variable "enable_cost_dashboard" {
  description = "Enable CloudWatch dashboard for costs"
  type        = bool
  default     = true
}
