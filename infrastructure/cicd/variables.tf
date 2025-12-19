# Variables for CI/CD Infrastructure
# Reference: SEC-1060

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
# ECR Configuration
# =========================================

variable "create_ecr_repository" {
  description = "Whether to create ECR repository"
  type        = bool
  default     = true
}

variable "existing_ecr_repository_url" {
  description = "URL of existing ECR repository (if not creating new one)"
  type        = string
  default     = ""
}

variable "ecr_image_tag_mutability" {
  description = "Image tag mutability (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.ecr_image_tag_mutability)
    error_message = "Image tag mutability must be MUTABLE or IMMUTABLE"
  }
}

variable "ecr_scan_on_push" {
  description = "Enable image vulnerability scanning on push"
  type        = bool
  default     = true
}

variable "ecr_encryption_type" {
  description = "Encryption type for ECR (AES256 or KMS)"
  type        = string
  default     = "AES256"
  validation {
    condition     = contains(["AES256", "KMS"], var.ecr_encryption_type)
    error_message = "Encryption type must be AES256 or KMS"
  }
}

variable "ecr_kms_key_id" {
  description = "KMS key ID for ECR encryption (if using KMS)"
  type        = string
  default     = ""
}

variable "ecr_keep_image_count" {
  description = "Number of tagged images to keep"
  type        = number
  default     = 10
}

variable "ecr_untagged_expiration_days" {
  description = "Days to keep untagged images before expiration"
  type        = number
  default     = 7
}

# =========================================
# CodePipeline Configuration
# =========================================

variable "create_codepipeline" {
  description = "Whether to create CodePipeline (set false for GitHub Actions only)"
  type        = bool
  default     = false
}

variable "codestar_connection_arn" {
  description = "ARN of CodeStar connection to GitHub (required for CodePipeline)"
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "GitHub branch to deploy from"
  type        = string
  default     = "main"
}

variable "pipeline_artifact_retention_days" {
  description = "Days to retain pipeline artifacts"
  type        = number
  default     = 30
}

# =========================================
# CodeBuild Configuration
# =========================================

variable "codebuild_compute_type" {
  description = "CodeBuild compute type"
  type        = string
  default     = "BUILD_GENERAL1_SMALL"
  validation {
    condition = contains([
      "BUILD_GENERAL1_SMALL",
      "BUILD_GENERAL1_MEDIUM",
      "BUILD_GENERAL1_LARGE",
      "BUILD_GENERAL1_2XLARGE"
    ], var.codebuild_compute_type)
    error_message = "Invalid compute type"
  }
}

variable "codebuild_image" {
  description = "Docker image for CodeBuild"
  type        = string
  default     = "aws/codebuild/standard:7.0"
}

variable "codebuild_timeout_minutes" {
  description = "Build timeout in minutes"
  type        = number
  default     = 20
}

variable "codebuild_cache_type" {
  description = "Cache type (NO_CACHE, S3, or LOCAL)"
  type        = string
  default     = "S3"
  validation {
    condition     = contains(["NO_CACHE", "S3", "LOCAL"], var.codebuild_cache_type)
    error_message = "Cache type must be NO_CACHE, S3, or LOCAL"
  }
}

variable "custom_buildspec" {
  description = "Custom buildspec content (overrides default)"
  type        = string
  default     = ""
}

variable "codebuild_environment_variables" {
  description = "Additional environment variables for CodeBuild"
  type        = map(string)
  default     = {}
}

# =========================================
# Deployment Configuration
# =========================================

variable "deploy_to_ecs" {
  description = "Whether to deploy to ECS (set false for Amplify)"
  type        = bool
  default     = true
}

variable "ecs_cluster_name" {
  description = "ECS cluster name for deployment"
  type        = string
  default     = ""
}

variable "ecs_service_name" {
  description = "ECS service name for deployment"
  type        = string
  default     = ""
}

# =========================================
# Secrets Configuration
# =========================================

variable "secrets_manager_arns" {
  description = "List of Secrets Manager ARNs that CodeBuild needs access to"
  type        = list(string)
  default     = []
}

# =========================================
# Monitoring Configuration
# =========================================

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_pipeline_alarms" {
  description = "Enable CloudWatch alarms for pipeline failures"
  type        = bool
  default     = true
}

variable "pipeline_alarm_actions" {
  description = "SNS topic ARNs to notify on pipeline failures"
  type        = list(string)
  default     = []
}
