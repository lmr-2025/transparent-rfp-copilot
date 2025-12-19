# Outputs for Secrets Manager Module

# -----------------------------------------------------------------------------
# Secret ARNs
# -----------------------------------------------------------------------------

output "nextauth_secret_arn" {
  description = "ARN of the NextAuth secret"
  value       = var.create_nextauth_secret ? aws_secretsmanager_secret.nextauth_secret[0].arn : null
}

output "anthropic_api_key_secret_arn" {
  description = "ARN of the Anthropic API key secret"
  value       = var.create_anthropic_secret ? aws_secretsmanager_secret.anthropic_api_key[0].arn : null
}

output "google_oauth_secret_arn" {
  description = "ARN of the Google OAuth credentials secret"
  value       = var.create_google_oauth_secret ? aws_secretsmanager_secret.google_oauth[0].arn : null
}

output "upstash_redis_secret_arn" {
  description = "ARN of the Upstash Redis credentials secret"
  value       = var.create_upstash_redis_secret ? aws_secretsmanager_secret.upstash_redis[0].arn : null
}

output "encryption_key_secret_arn" {
  description = "ARN of the application encryption key secret"
  value       = var.create_encryption_key ? aws_secretsmanager_secret.encryption_key[0].arn : null
}

output "custom_secret_arns" {
  description = "Map of custom secret ARNs"
  value       = { for k, v in aws_secretsmanager_secret.custom_secrets : k => v.arn }
}

# -----------------------------------------------------------------------------
# Secret Names
# -----------------------------------------------------------------------------

output "nextauth_secret_name" {
  description = "Name of the NextAuth secret"
  value       = var.create_nextauth_secret ? aws_secretsmanager_secret.nextauth_secret[0].name : null
}

output "anthropic_api_key_secret_name" {
  description = "Name of the Anthropic API key secret"
  value       = var.create_anthropic_secret ? aws_secretsmanager_secret.anthropic_api_key[0].name : null
}

output "google_oauth_secret_name" {
  description = "Name of the Google OAuth credentials secret"
  value       = var.create_google_oauth_secret ? aws_secretsmanager_secret.google_oauth[0].name : null
}

output "upstash_redis_secret_name" {
  description = "Name of the Upstash Redis credentials secret"
  value       = var.create_upstash_redis_secret ? aws_secretsmanager_secret.upstash_redis[0].name : null
}

output "encryption_key_secret_name" {
  description = "Name of the application encryption key secret"
  value       = var.create_encryption_key ? aws_secretsmanager_secret.encryption_key[0].name : null
}

output "custom_secret_names" {
  description = "Map of custom secret names"
  value       = { for k, v in aws_secretsmanager_secret.custom_secrets : k => v.name }
}

# -----------------------------------------------------------------------------
# IAM Policy
# -----------------------------------------------------------------------------

output "secrets_access_policy_arn" {
  description = "ARN of the IAM policy for secrets access"
  value       = aws_iam_policy.secrets_access.arn
}

output "secrets_access_policy_name" {
  description = "Name of the IAM policy for secrets access"
  value       = aws_iam_policy.secrets_access.name
}

# -----------------------------------------------------------------------------
# Rotation Configuration
# -----------------------------------------------------------------------------

output "rds_rotation_lambda_arn" {
  description = "ARN of the RDS rotation Lambda function (if enabled)"
  value       = var.enable_rds_rotation ? aws_lambda_function.rds_rotation[0].arn : null
}

output "rds_rotation_lambda_role_arn" {
  description = "ARN of the RDS rotation Lambda IAM role (if enabled)"
  value       = var.enable_rds_rotation ? aws_iam_role.rds_rotation_lambda[0].arn : null
}

# -----------------------------------------------------------------------------
# Database Secret (if imported)
# -----------------------------------------------------------------------------

output "database_secret_arn" {
  description = "ARN of the RDS database secret (if imported)"
  value       = var.import_rds_secret ? data.aws_secretsmanager_secret.database[0].arn : null
}

output "database_secret_name" {
  description = "Name of the RDS database secret (if imported)"
  value       = var.import_rds_secret ? data.aws_secretsmanager_secret.database[0].name : null
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "secrets_summary" {
  description = "Summary of all secrets created"
  value = {
    nextauth = var.create_nextauth_secret ? {
      arn  = aws_secretsmanager_secret.nextauth_secret[0].arn
      name = aws_secretsmanager_secret.nextauth_secret[0].name
    } : null

    anthropic = var.create_anthropic_secret ? {
      arn  = aws_secretsmanager_secret.anthropic_api_key[0].arn
      name = aws_secretsmanager_secret.anthropic_api_key[0].name
    } : null

    google_oauth = var.create_google_oauth_secret ? {
      arn  = aws_secretsmanager_secret.google_oauth[0].arn
      name = aws_secretsmanager_secret.google_oauth[0].name
    } : null

    upstash_redis = var.create_upstash_redis_secret ? {
      arn  = aws_secretsmanager_secret.upstash_redis[0].arn
      name = aws_secretsmanager_secret.upstash_redis[0].name
    } : null

    encryption_key = var.create_encryption_key ? {
      arn  = aws_secretsmanager_secret.encryption_key[0].arn
      name = aws_secretsmanager_secret.encryption_key[0].name
    } : null

    database = var.import_rds_secret ? {
      arn  = data.aws_secretsmanager_secret.database[0].arn
      name = data.aws_secretsmanager_secret.database[0].name
    } : null

    custom_secrets = { for k, v in aws_secretsmanager_secret.custom_secrets : k => {
      arn  = v.arn
      name = v.name
    } }

    rotation_enabled = var.enable_rds_rotation
    rotation_days    = var.enable_rds_rotation ? var.rotation_days : null
  }
}

# -----------------------------------------------------------------------------
# Environment Variables Template (for application configuration)
# -----------------------------------------------------------------------------

output "environment_variables_template" {
  description = "Template for environment variables using secret ARNs (for ECS task definitions)"
  value = {
    NEXTAUTH_SECRET = var.create_nextauth_secret ? {
      secretArn = "${aws_secretsmanager_secret.nextauth_secret[0].arn}"
    } : null

    ANTHROPIC_API_KEY = var.create_anthropic_secret ? {
      secretArn = "${aws_secretsmanager_secret.anthropic_api_key[0].arn}"
    } : null

    GOOGLE_CLIENT_ID = var.create_google_oauth_secret ? {
      secretArn = "${aws_secretsmanager_secret.google_oauth[0].arn}:client_id::"
    } : null

    GOOGLE_CLIENT_SECRET = var.create_google_oauth_secret ? {
      secretArn = "${aws_secretsmanager_secret.google_oauth[0].arn}:client_secret::"
    } : null

    UPSTASH_REDIS_REST_URL = var.create_upstash_redis_secret ? {
      secretArn = "${aws_secretsmanager_secret.upstash_redis[0].arn}:url::"
    } : null

    UPSTASH_REDIS_REST_TOKEN = var.create_upstash_redis_secret ? {
      secretArn = "${aws_secretsmanager_secret.upstash_redis[0].arn}:token::"
    } : null

    ENCRYPTION_KEY = var.create_encryption_key ? {
      secretArn = "${aws_secretsmanager_secret.encryption_key[0].arn}"
    } : null

    DATABASE_URL = var.import_rds_secret ? {
      secretArn = "${data.aws_secretsmanager_secret.database[0].arn}"
    } : null
  }
}
