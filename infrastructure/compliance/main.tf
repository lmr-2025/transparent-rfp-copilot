# Compliance & Governance Infrastructure for Transparent Trust
# Reference: SEC-1061 - Compliance & Governance

# This module provides comprehensive compliance and governance capabilities including
# CloudTrail for audit logging, AWS Config for compliance monitoring, GuardDuty for
# threat detection, and optional Security Hub for centralized security management.

# =========================================
# CloudTrail - Audit Logging
# =========================================

# S3 bucket for CloudTrail logs (if not using existing)
resource "aws_s3_bucket" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = "${var.project_name}-cloudtrail-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cloudtrail-${var.environment}"
    Environment = var.environment
    Compliance  = "required"
  })
}

# Enable versioning for CloudTrail bucket
resource "aws_s3_bucket_versioning" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = aws_s3_bucket.cloudtrail[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption for CloudTrail bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = aws_s3_bucket.cloudtrail[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to CloudTrail bucket
resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = aws_s3_bucket.cloudtrail[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for CloudTrail logs
resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = aws_s3_bucket.cloudtrail[0].id

  rule {
    id     = "cloudtrail-logs-lifecycle"
    status = "Enabled"

    transition {
      days          = var.cloudtrail_transition_to_ia_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.cloudtrail_transition_to_glacier_days
      storage_class = "GLACIER"
    }

    expiration {
      days = var.cloudtrail_expiration_days
    }
  }
}

# Bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "cloudtrail" {
  count = var.create_cloudtrail_bucket ? 1 : 0

  bucket = aws_s3_bucket.cloudtrail[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail[0].arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail[0].arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# CloudTrail trail
resource "aws_cloudtrail" "main" {
  count = var.enable_cloudtrail ? 1 : 0

  name                          = "${var.project_name}-trail-${var.environment}"
  s3_bucket_name                = var.create_cloudtrail_bucket ? aws_s3_bucket.cloudtrail[0].id : var.existing_cloudtrail_bucket
  include_global_service_events = true
  is_multi_region_trail         = var.cloudtrail_multi_region
  enable_log_file_validation    = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = var.cloudtrail_s3_data_events ? ["arn:aws:s3:::*/*"] : []
    }

    data_resource {
      type   = "AWS::Lambda::Function"
      values = var.cloudtrail_lambda_data_events ? ["arn:aws:lambda:*:${data.aws_caller_identity.current.account_id}:function/*"] : []
    }
  }

  dynamic "insight_selector" {
    for_each = var.cloudtrail_enable_insights ? [1] : []

    content {
      insight_type = "ApiCallRateInsight"
    }
  }

  cloud_watch_logs_group_arn = var.cloudtrail_cloudwatch_logs ? "${aws_cloudwatch_log_group.cloudtrail[0].arn}:*" : null
  cloud_watch_logs_role_arn  = var.cloudtrail_cloudwatch_logs ? aws_iam_role.cloudtrail_cloudwatch[0].arn : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cloudtrail-${var.environment}"
    Environment = var.environment
    Compliance  = "required"
  })

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}

# CloudWatch log group for CloudTrail
resource "aws_cloudwatch_log_group" "cloudtrail" {
  count = var.enable_cloudtrail && var.cloudtrail_cloudwatch_logs ? 1 : 0

  name              = "/aws/cloudtrail/${var.project_name}-${var.environment}"
  retention_in_days = var.cloudtrail_log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cloudtrail-logs-${var.environment}"
    Environment = var.environment
  })
}

# IAM role for CloudTrail to CloudWatch Logs
resource "aws_iam_role" "cloudtrail_cloudwatch" {
  count = var.enable_cloudtrail && var.cloudtrail_cloudwatch_logs ? 1 : 0

  name = "${var.project_name}-cloudtrail-cloudwatch-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cloudtrail-cloudwatch-role-${var.environment}"
    Environment = var.environment
  })
}

# IAM policy for CloudTrail to CloudWatch Logs
resource "aws_iam_role_policy" "cloudtrail_cloudwatch" {
  count = var.enable_cloudtrail && var.cloudtrail_cloudwatch_logs ? 1 : 0

  role = aws_iam_role.cloudtrail_cloudwatch[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.cloudtrail[0].arn}:*"
      }
    ]
  })
}

# =========================================
# AWS Config - Compliance Monitoring
# =========================================

# S3 bucket for AWS Config
resource "aws_s3_bucket" "config" {
  count = var.enable_config && var.create_config_bucket ? 1 : 0

  bucket = "${var.project_name}-config-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-config-${var.environment}"
    Environment = var.environment
    Compliance  = "required"
  })
}

# Server-side encryption for Config bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "config" {
  count = var.enable_config && var.create_config_bucket ? 1 : 0

  bucket = aws_s3_bucket.config[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to Config bucket
resource "aws_s3_bucket_public_access_block" "config" {
  count = var.enable_config && var.create_config_bucket ? 1 : 0

  bucket = aws_s3_bucket.config[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy for AWS Config
resource "aws_s3_bucket_policy" "config" {
  count = var.enable_config && var.create_config_bucket ? 1 : 0

  bucket = aws_s3_bucket.config[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSConfigBucketPermissionsCheck"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.config[0].arn
      },
      {
        Sid    = "AWSConfigBucketExistenceCheck"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.config[0].arn
      },
      {
        Sid    = "AWSConfigWrite"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.config[0].arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# IAM role for AWS Config
resource "aws_iam_role" "config" {
  count = var.enable_config ? 1 : 0

  name = "${var.project_name}-config-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/ConfigRole"]

  tags = merge(var.tags, {
    Name        = "${var.project_name}-config-role-${var.environment}"
    Environment = var.environment
  })
}

# IAM policy for AWS Config S3 access
resource "aws_iam_role_policy" "config_s3" {
  count = var.enable_config && var.create_config_bucket ? 1 : 0

  role = aws_iam_role.config[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketVersioning",
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = [
          aws_s3_bucket.config[0].arn,
          "${aws_s3_bucket.config[0].arn}/*"
        ]
      }
    ]
  })
}

# AWS Config recorder
resource "aws_config_configuration_recorder" "main" {
  count = var.enable_config ? 1 : 0

  name     = "${var.project_name}-config-recorder-${var.environment}"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = var.config_include_global_resources
  }
}

# AWS Config delivery channel
resource "aws_config_delivery_channel" "main" {
  count = var.enable_config ? 1 : 0

  name           = "${var.project_name}-config-delivery-${var.environment}"
  s3_bucket_name = var.create_config_bucket ? aws_s3_bucket.config[0].id : var.existing_config_bucket

  depends_on = [aws_config_configuration_recorder.main]
}

# Start the AWS Config recorder
resource "aws_config_configuration_recorder_status" "main" {
  count = var.enable_config ? 1 : 0

  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

# =========================================
# AWS Config Rules
# =========================================

# S3 bucket encryption enabled
resource "aws_config_config_rule" "s3_bucket_encryption" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-s3-encryption-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# RDS encryption enabled
resource "aws_config_config_rule" "rds_encryption" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-rds-encryption-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# Security group unrestricted SSH
resource "aws_config_config_rule" "sg_ssh_restricted" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-sg-ssh-restricted-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "INCOMING_SSH_DISABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# IAM password policy
resource "aws_config_config_rule" "iam_password_policy" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-iam-password-policy-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "IAM_PASSWORD_POLICY"
  }

  input_parameters = jsonencode({
    RequireUppercaseCharacters = true
    RequireLowercaseCharacters = true
    RequireSymbols             = true
    RequireNumbers             = true
    MinimumPasswordLength      = 14
    MaxPasswordAge             = 90
  })

  depends_on = [aws_config_configuration_recorder.main]
}

# Root account MFA enabled
resource "aws_config_config_rule" "root_mfa_enabled" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-root-mfa-enabled-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCOUNT_MFA_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# CloudTrail enabled
resource "aws_config_config_rule" "cloudtrail_enabled" {
  count = var.enable_config && var.enable_config_rules ? 1 : 0

  name = "${var.project_name}-cloudtrail-enabled-${var.environment}"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# =========================================
# GuardDuty - Threat Detection
# =========================================

# GuardDuty detector
resource "aws_guardduty_detector" "main" {
  count = var.enable_guardduty ? 1 : 0

  enable                       = true
  finding_publishing_frequency = var.guardduty_finding_frequency

  datasources {
    s3_logs {
      enable = var.guardduty_s3_logs
    }
    kubernetes {
      audit_logs {
        enable = var.guardduty_kubernetes_audit_logs
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = var.guardduty_malware_protection
        }
      }
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-guardduty-${var.environment}"
    Environment = var.environment
  })
}

# SNS topic for GuardDuty findings
resource "aws_sns_topic" "guardduty" {
  count = var.enable_guardduty && var.guardduty_notification_enabled ? 1 : 0

  name         = "${var.project_name}-guardduty-findings-${var.environment}"
  display_name = "GuardDuty Findings for ${var.project_name} (${var.environment})"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-guardduty-topic-${var.environment}"
    Environment = var.environment
  })
}

# SNS topic subscriptions for GuardDuty
resource "aws_sns_topic_subscription" "guardduty_email" {
  for_each = var.enable_guardduty && var.guardduty_notification_enabled ? toset(var.guardduty_notification_emails) : []

  topic_arn = aws_sns_topic.guardduty[0].arn
  protocol  = "email"
  endpoint  = each.value
}

# EventBridge rule for GuardDuty findings
resource "aws_cloudwatch_event_rule" "guardduty" {
  count = var.enable_guardduty && var.guardduty_notification_enabled ? 1 : 0

  name        = "${var.project_name}-guardduty-findings-${var.environment}"
  description = "Capture GuardDuty findings"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [4, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6, 6.0, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9]
    }
  })
}

# EventBridge target for GuardDuty findings
resource "aws_cloudwatch_event_target" "guardduty" {
  count = var.enable_guardduty && var.guardduty_notification_enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty[0].name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.guardduty[0].arn
}

# SNS topic policy for EventBridge
resource "aws_sns_topic_policy" "guardduty" {
  count = var.enable_guardduty && var.guardduty_notification_enabled ? 1 : 0

  arn = aws_sns_topic.guardduty[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.guardduty[0].arn
      }
    ]
  })
}

# =========================================
# AWS Security Hub
# =========================================

# Security Hub
resource "aws_securityhub_account" "main" {
  count = var.enable_security_hub ? 1 : 0
}

# Enable AWS Foundational Security Best Practices standard
resource "aws_securityhub_standards_subscription" "aws_foundational" {
  count = var.enable_security_hub && var.security_hub_enable_aws_foundational ? 1 : 0

  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"

  depends_on = [aws_securityhub_account.main]
}

# Enable CIS AWS Foundations Benchmark standard
resource "aws_securityhub_standards_subscription" "cis" {
  count = var.enable_security_hub && var.security_hub_enable_cis ? 1 : 0

  standards_arn = "arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0"

  depends_on = [aws_securityhub_account.main]
}

# Enable PCI DSS standard
resource "aws_securityhub_standards_subscription" "pci_dss" {
  count = var.enable_security_hub && var.security_hub_enable_pci_dss ? 1 : 0

  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/pci-dss/v/3.2.1"

  depends_on = [aws_securityhub_account.main]
}

# =========================================
# Data Sources
# =========================================

data "aws_caller_identity" "current" {}
