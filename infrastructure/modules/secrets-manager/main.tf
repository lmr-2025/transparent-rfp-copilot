# AWS Secrets Manager for Transparent RFP Copilot
#
# This module creates and manages application secrets with automatic rotation

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Database Credentials Secret (managed by RDS module)
# -----------------------------------------------------------------------------

# Note: Database credentials are typically created by the RDS module
# This is a data source reference if the RDS secret already exists
data "aws_secretsmanager_secret" "database" {
  count = var.import_rds_secret ? 1 : 0
  name  = var.database_secret_name
}

# -----------------------------------------------------------------------------
# NextAuth Secret
# -----------------------------------------------------------------------------

resource "random_password" "nextauth_secret" {
  count   = var.create_nextauth_secret ? 1 : 0
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "nextauth_secret" {
  count = var.create_nextauth_secret ? 1 : 0

  name        = "${var.project_name}-nextauth-secret-${var.environment}"
  description = "NextAuth.js secret for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-nextauth-secret-${var.environment}"
      Environment = var.environment
      Purpose     = "NextAuth.js encryption"
    }
  )
}

resource "aws_secretsmanager_secret_version" "nextauth_secret" {
  count = var.create_nextauth_secret ? 1 : 0

  secret_id     = aws_secretsmanager_secret.nextauth_secret[0].id
  secret_string = random_password.nextauth_secret[0].result
}

# -----------------------------------------------------------------------------
# Anthropic API Key
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  count = var.create_anthropic_secret ? 1 : 0

  name        = "${var.project_name}-anthropic-api-key-${var.environment}"
  description = "Anthropic API key for Claude (${var.environment})"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-anthropic-api-key-${var.environment}"
      Environment = var.environment
      Purpose     = "Claude API access"
    }
  )
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  count = var.create_anthropic_secret ? 1 : 0

  secret_id     = aws_secretsmanager_secret.anthropic_api_key[0].id
  secret_string = var.anthropic_api_key_value
}

# -----------------------------------------------------------------------------
# Google OAuth Credentials
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "google_oauth" {
  count = var.create_google_oauth_secret ? 1 : 0

  name        = "${var.project_name}-google-oauth-${var.environment}"
  description = "Google OAuth credentials for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-google-oauth-${var.environment}"
      Environment = var.environment
      Purpose     = "Google OAuth authentication"
    }
  )
}

resource "aws_secretsmanager_secret_version" "google_oauth" {
  count = var.create_google_oauth_secret ? 1 : 0

  secret_id = aws_secretsmanager_secret.google_oauth[0].id
  secret_string = jsonencode({
    client_id     = var.google_client_id
    client_secret = var.google_client_secret
  })
}

# -----------------------------------------------------------------------------
# Upstash Redis Credentials
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "upstash_redis" {
  count = var.create_upstash_redis_secret ? 1 : 0

  name        = "${var.project_name}-upstash-redis-${var.environment}"
  description = "Upstash Redis credentials for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-upstash-redis-${var.environment}"
      Environment = var.environment
      Purpose     = "Redis rate limiting"
    }
  )
}

resource "aws_secretsmanager_secret_version" "upstash_redis" {
  count = var.create_upstash_redis_secret ? 1 : 0

  secret_id = aws_secretsmanager_secret.upstash_redis[0].id
  secret_string = jsonencode({
    url   = var.upstash_redis_url
    token = var.upstash_redis_token
  })
}

# -----------------------------------------------------------------------------
# Application Encryption Key
# -----------------------------------------------------------------------------

resource "random_password" "encryption_key" {
  count   = var.create_encryption_key ? 1 : 0
  length  = 32
  special = false # Only alphanumeric for easier handling
}

resource "aws_secretsmanager_secret" "encryption_key" {
  count = var.create_encryption_key ? 1 : 0

  name        = "${var.project_name}-encryption-key-${var.environment}"
  description = "Application settings encryption key for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-encryption-key-${var.environment}"
      Environment = var.environment
      Purpose     = "Application data encryption"
    }
  )
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  count = var.create_encryption_key ? 1 : 0

  secret_id     = aws_secretsmanager_secret.encryption_key[0].id
  secret_string = random_password.encryption_key[0].result
}

# -----------------------------------------------------------------------------
# Custom Secrets (for additional application secrets)
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "custom_secrets" {
  for_each = nonsensitive(var.custom_secrets)

  name        = "${var.project_name}-${each.key}-${var.environment}"
  description = each.value.description

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    each.value.tags,
    {
      Name        = "${var.project_name}-${each.key}-${var.environment}"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "custom_secrets" {
  for_each = nonsensitive(var.custom_secrets)

  secret_id     = aws_secretsmanager_secret.custom_secrets[each.key].id
  secret_string = each.value.value
}

# -----------------------------------------------------------------------------
# IAM Policy for Secrets Access
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "secrets_access" {
  name        = "${var.project_name}-secrets-access-${var.environment}"
  path        = "/"
  description = "Allow access to ${var.project_name} secrets (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecretValues"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = concat(
          var.create_nextauth_secret ? [aws_secretsmanager_secret.nextauth_secret[0].arn] : [],
          var.create_anthropic_secret ? [aws_secretsmanager_secret.anthropic_api_key[0].arn] : [],
          var.create_google_oauth_secret ? [aws_secretsmanager_secret.google_oauth[0].arn] : [],
          var.create_upstash_redis_secret ? [aws_secretsmanager_secret.upstash_redis[0].arn] : [],
          var.create_encryption_key ? [aws_secretsmanager_secret.encryption_key[0].arn] : [],
          [for secret in aws_secretsmanager_secret.custom_secrets : secret.arn],
          var.import_rds_secret ? [data.aws_secretsmanager_secret.database[0].arn] : []
        )
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn != "" ? [var.kms_key_arn] : ["*"]
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-secrets-access-${var.environment}"
      Environment = var.environment
    }
  )
}

# Attach policy to application role
resource "aws_iam_role_policy_attachment" "secrets_access" {
  count = var.app_role_name != "" ? 1 : 0

  role       = var.app_role_name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# -----------------------------------------------------------------------------
# Automatic Rotation for RDS (optional)
# -----------------------------------------------------------------------------

# Lambda function for RDS secret rotation
resource "aws_lambda_function" "rds_rotation" {
  count = var.enable_rds_rotation ? 1 : 0

  filename      = "${path.module}/lambda/rds-rotation.zip"
  function_name = "${var.project_name}-rds-rotation-${var.environment}"
  role          = aws_iam_role.rds_rotation_lambda[0].arn
  handler       = "index.handler"
  runtime       = "python3.11"
  timeout       = 30

  environment {
    variables = {
      SECRETS_MANAGER_ENDPOINT = "https://secretsmanager.${data.aws_region.current.name}.amazonaws.com"
    }
  }

  vpc_config {
    subnet_ids         = var.lambda_subnet_ids
    security_group_ids = var.lambda_security_group_ids
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-rds-rotation-${var.environment}"
      Environment = var.environment
      Purpose     = "RDS secret rotation"
    }
  )
}

# IAM role for rotation Lambda
resource "aws_iam_role" "rds_rotation_lambda" {
  count = var.enable_rds_rotation ? 1 : 0

  name = "${var.project_name}-rds-rotation-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-rds-rotation-lambda-${var.environment}"
      Environment = var.environment
    }
  )
}

# Rotation Lambda policy
resource "aws_iam_role_policy" "rds_rotation_lambda" {
  count = var.enable_rds_rotation ? 1 : 0

  name = "rds-rotation-policy"
  role = aws_iam_role.rds_rotation_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = var.import_rds_secret ? data.aws_secretsmanager_secret.database[0].arn : "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetRandomPassword"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Enable rotation on RDS secret
resource "aws_secretsmanager_secret_rotation" "database" {
  count = var.enable_rds_rotation && var.import_rds_secret ? 1 : 0

  secret_id           = data.aws_secretsmanager_secret.database[0].id
  rotation_lambda_arn = aws_lambda_function.rds_rotation[0].arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Secret Access
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "secret_access_denied" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-secret-access-denied-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UserErrorCount"
  namespace           = "AWS/SecretsManager"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when secret access is denied multiple times"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
