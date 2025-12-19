# Variables for Secrets Manager Module

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
}

# -----------------------------------------------------------------------------
# Secret Creation Flags
# -----------------------------------------------------------------------------

variable "create_nextauth_secret" {
  description = "Create NextAuth.js secret"
  type        = bool
  default     = true
}

variable "create_anthropic_secret" {
  description = "Create Anthropic API key secret"
  type        = bool
  default     = true
}

variable "create_google_oauth_secret" {
  description = "Create Google OAuth credentials secret"
  type        = bool
  default     = true
}

variable "create_upstash_redis_secret" {
  description = "Create Upstash Redis credentials secret"
  type        = bool
  default     = false
}

variable "create_encryption_key" {
  description = "Create application encryption key"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Secret Values (mark as sensitive in your tfvars)
# -----------------------------------------------------------------------------

variable "anthropic_api_key_value" {
  description = "Anthropic API key value (sensitive)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret (sensitive)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "upstash_redis_url" {
  description = "Upstash Redis REST URL"
  type        = string
  default     = ""
}

variable "upstash_redis_token" {
  description = "Upstash Redis REST token (sensitive)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Custom Secrets
# -----------------------------------------------------------------------------

variable "custom_secrets" {
  description = "Map of custom secrets to create"
  type = map(object({
    description = string
    value       = string
    tags        = map(string)
  }))
  default   = {}
  sensitive = true
}

# -----------------------------------------------------------------------------
# RDS Secret Configuration
# -----------------------------------------------------------------------------

variable "import_rds_secret" {
  description = "Import existing RDS secret created by RDS module"
  type        = bool
  default     = false
}

variable "database_secret_name" {
  description = "Name of the RDS database secret (if importing)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# IAM Configuration
# -----------------------------------------------------------------------------

variable "app_role_name" {
  description = "Name of the application IAM role to attach secrets policy"
  type        = string
  default     = ""
}

variable "kms_key_arn" {
  description = "ARN of KMS key for secret encryption (optional, uses AWS managed key if not specified)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Rotation Configuration
# -----------------------------------------------------------------------------

variable "enable_rds_rotation" {
  description = "Enable automatic rotation for RDS database secret"
  type        = bool
  default     = false
}

variable "rotation_days" {
  description = "Number of days between automatic rotations"
  type        = number
  default     = 30
}

variable "lambda_subnet_ids" {
  description = "Subnet IDs for rotation Lambda function (must have access to RDS)"
  type        = list(string)
  default     = []
}

variable "lambda_security_group_ids" {
  description = "Security group IDs for rotation Lambda function"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Secret Management
# -----------------------------------------------------------------------------

variable "recovery_window_in_days" {
  description = "Number of days to retain deleted secrets (0-30, 0 for immediate deletion)"
  type        = number
  default     = 30

  validation {
    condition     = var.recovery_window_in_days >= 0 && var.recovery_window_in_days <= 30
    error_message = "Recovery window must be between 0 and 30 days."
  }
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for secret access monitoring"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
