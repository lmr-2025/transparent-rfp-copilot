# Variables for Compliance & Governance Infrastructure
# Reference: SEC-1061

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
# CloudTrail Configuration
# =========================================

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

variable "create_cloudtrail_bucket" {
  description = "Create S3 bucket for CloudTrail logs"
  type        = bool
  default     = true
}

variable "existing_cloudtrail_bucket" {
  description = "Name of existing S3 bucket for CloudTrail (if not creating)"
  type        = string
  default     = ""
}

variable "cloudtrail_multi_region" {
  description = "Enable CloudTrail in all regions"
  type        = bool
  default     = true
}

variable "cloudtrail_s3_data_events" {
  description = "Log S3 data events (read/write operations)"
  type        = bool
  default     = false
}

variable "cloudtrail_lambda_data_events" {
  description = "Log Lambda data events (invocations)"
  type        = bool
  default     = false
}

variable "cloudtrail_enable_insights" {
  description = "Enable CloudTrail Insights for anomaly detection"
  type        = bool
  default     = false
}

variable "cloudtrail_cloudwatch_logs" {
  description = "Send CloudTrail logs to CloudWatch Logs"
  type        = bool
  default     = true
}

variable "cloudtrail_log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 90
}

variable "cloudtrail_transition_to_ia_days" {
  description = "Days before transitioning to Infrequent Access"
  type        = number
  default     = 90
}

variable "cloudtrail_transition_to_glacier_days" {
  description = "Days before transitioning to Glacier"
  type        = number
  default     = 180
}

variable "cloudtrail_expiration_days" {
  description = "Days before expiring CloudTrail logs (0 = never expire)"
  type        = number
  default     = 365
}

# =========================================
# AWS Config Configuration
# =========================================

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

variable "create_config_bucket" {
  description = "Create S3 bucket for AWS Config"
  type        = bool
  default     = true
}

variable "existing_config_bucket" {
  description = "Name of existing S3 bucket for Config (if not creating)"
  type        = string
  default     = ""
}

variable "config_include_global_resources" {
  description = "Include global resources (IAM, etc) in Config"
  type        = bool
  default     = true
}

variable "enable_config_rules" {
  description = "Enable AWS Config managed rules"
  type        = bool
  default     = true
}

# =========================================
# GuardDuty Configuration
# =========================================

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "guardduty_finding_frequency" {
  description = "Frequency of notifications (FIFTEEN_MINUTES, ONE_HOUR, SIX_HOURS)"
  type        = string
  default     = "FIFTEEN_MINUTES"
  validation {
    condition     = contains(["FIFTEEN_MINUTES", "ONE_HOUR", "SIX_HOURS"], var.guardduty_finding_frequency)
    error_message = "Finding frequency must be FIFTEEN_MINUTES, ONE_HOUR, or SIX_HOURS"
  }
}

variable "guardduty_s3_logs" {
  description = "Enable S3 protection in GuardDuty"
  type        = bool
  default     = true
}

variable "guardduty_kubernetes_audit_logs" {
  description = "Enable Kubernetes audit logs in GuardDuty"
  type        = bool
  default     = false
}

variable "guardduty_malware_protection" {
  description = "Enable malware protection for EC2"
  type        = bool
  default     = false
}

variable "guardduty_notification_enabled" {
  description = "Enable SNS notifications for GuardDuty findings"
  type        = bool
  default     = true
}

variable "guardduty_notification_emails" {
  description = "Email addresses to notify of GuardDuty findings"
  type        = list(string)
  default     = []
}

# =========================================
# Security Hub Configuration
# =========================================

variable "enable_security_hub" {
  description = "Enable AWS Security Hub"
  type        = bool
  default     = false
}

variable "security_hub_enable_aws_foundational" {
  description = "Enable AWS Foundational Security Best Practices standard"
  type        = bool
  default     = true
}

variable "security_hub_enable_cis" {
  description = "Enable CIS AWS Foundations Benchmark standard"
  type        = bool
  default     = true
}

variable "security_hub_enable_pci_dss" {
  description = "Enable PCI DSS standard"
  type        = bool
  default     = false
}
