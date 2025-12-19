# CI/CD Infrastructure for Transparent Trust
# Reference: SEC-1060 - CI/CD Pipeline

# This module provides CI/CD infrastructure with GitHub Actions and AWS CodePipeline options
# for automated deployment of the Transparent Trust application.

# =========================================
# ECR Repository for Docker Images
# =========================================

resource "aws_ecr_repository" "main" {
  count = var.create_ecr_repository ? 1 : 0

  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = var.ecr_image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.ecr_scan_on_push
  }

  encryption_configuration {
    encryption_type = var.ecr_encryption_type
    kms_key         = var.ecr_encryption_type == "KMS" ? var.ecr_kms_key_id : null
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-ecr-${var.environment}"
    Environment = var.environment
  })
}

# ECR lifecycle policy to clean up old images
resource "aws_ecr_lifecycle_policy" "main" {
  count = var.create_ecr_repository ? 1 : 0

  repository = aws_ecr_repository.main[0].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.ecr_keep_image_count} images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "release"]
          countType     = "imageCountMoreThan"
          countNumber   = var.ecr_keep_image_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images after ${var.ecr_untagged_expiration_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.ecr_untagged_expiration_days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# =========================================
# CodeBuild Project
# =========================================

# IAM role for CodeBuild
resource "aws_iam_role" "codebuild" {
  count = var.create_codepipeline ? 1 : 0

  name = "${var.project_name}-codebuild-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-codebuild-role-${var.environment}"
    Environment = var.environment
  })
}

# IAM policy for CodeBuild
resource "aws_iam_role_policy" "codebuild" {
  count = var.create_codepipeline ? 1 : 0

  role = aws_iam_role.codebuild[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${var.project_name}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.pipeline_artifacts[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_manager_arns
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
      }
    ]
  })
}

# CodeBuild project
resource "aws_codebuild_project" "main" {
  count = var.create_codepipeline ? 1 : 0

  name          = "${var.project_name}-build-${var.environment}"
  description   = "Build project for ${var.project_name}"
  service_role  = aws_iam_role.codebuild[0].arn
  build_timeout = var.codebuild_timeout_minutes

  artifacts {
    type = "CODEPIPELINE"
  }

  cache {
    type     = var.codebuild_cache_type
    location = var.codebuild_cache_type == "S3" ? "${aws_s3_bucket.pipeline_artifacts[0].bucket}/build-cache" : null
  }

  environment {
    compute_type                = var.codebuild_compute_type
    image                       = var.codebuild_image
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true # Required for Docker builds

    dynamic "environment_variable" {
      for_each = var.codebuild_environment_variables
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }

    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }

    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "ECR_REPOSITORY"
      value = var.create_ecr_repository ? aws_ecr_repository.main[0].repository_url : var.existing_ecr_repository_url
    }

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = var.custom_buildspec != "" ? var.custom_buildspec : file("${path.module}/buildspec.yml")
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild[0].name
      stream_name = "build"
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-codebuild-${var.environment}"
    Environment = var.environment
  })
}

# CloudWatch log group for CodeBuild
resource "aws_cloudwatch_log_group" "codebuild" {
  count = var.create_codepipeline ? 1 : 0

  name              = "/aws/codebuild/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-codebuild-logs-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# CodePipeline
# =========================================

# S3 bucket for pipeline artifacts
resource "aws_s3_bucket" "pipeline_artifacts" {
  count = var.create_codepipeline ? 1 : 0

  bucket = "${var.project_name}-pipeline-artifacts-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-pipeline-artifacts-${var.environment}"
    Environment = var.environment
  })
}

# Enable versioning for artifacts bucket
resource "aws_s3_bucket_versioning" "pipeline_artifacts" {
  count = var.create_codepipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption for artifacts bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "pipeline_artifacts" {
  count = var.create_codepipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to artifacts bucket
resource "aws_s3_bucket_public_access_block" "pipeline_artifacts" {
  count = var.create_codepipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for artifacts
resource "aws_s3_bucket_lifecycle_configuration" "pipeline_artifacts" {
  count = var.create_codepipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"

    expiration {
      days = var.pipeline_artifact_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# IAM role for CodePipeline
resource "aws_iam_role" "codepipeline" {
  count = var.create_codepipeline ? 1 : 0

  name = "${var.project_name}-codepipeline-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codepipeline.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-codepipeline-role-${var.environment}"
    Environment = var.environment
  })
}

# IAM policy for CodePipeline
resource "aws_iam_role_policy" "codepipeline" {
  count = var.create_codepipeline ? 1 : 0

  role = aws_iam_role.codepipeline[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.pipeline_artifacts[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild"
        ]
        Resource = [
          aws_codebuild_project.main[0].arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codestar-connections:UseConnection"
        ]
        Resource = var.codestar_connection_arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = "*"
        Condition = {
          StringEqualsIfExists = {
            "iam:PassedToService" = [
              "ecs-tasks.amazonaws.com"
            ]
          }
        }
      }
    ]
  })
}

# CodePipeline
resource "aws_codepipeline" "main" {
  count = var.create_codepipeline ? 1 : 0

  name     = "${var.project_name}-pipeline-${var.environment}"
  role_arn = aws_iam_role.codepipeline[0].arn

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts[0].bucket
    type     = "S3"
  }

  # Source stage - GitHub
  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = var.codestar_connection_arn
        FullRepositoryId = var.github_repository
        BranchName       = var.github_branch
      }
    }
  }

  # Build stage
  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.main[0].name
      }
    }
  }

  # Deploy stage (ECS)
  dynamic "stage" {
    for_each = var.deploy_to_ecs ? [1] : []

    content {
      name = "Deploy"

      action {
        name            = "Deploy"
        category        = "Deploy"
        owner           = "AWS"
        provider        = "ECS"
        input_artifacts = ["build_output"]
        version         = "1"

        configuration = {
          ClusterName = var.ecs_cluster_name
          ServiceName = var.ecs_service_name
          FileName    = "imagedefinitions.json"
        }
      }
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-pipeline-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# CloudWatch Alarms for Pipeline
# =========================================

# Pipeline failure alarm
resource "aws_cloudwatch_metric_alarm" "pipeline_failed" {
  count = var.create_codepipeline && var.enable_pipeline_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-pipeline-failed-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PipelineExecutionFailure"
  namespace           = "AWS/CodePipeline"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "CodePipeline execution failed"
  alarm_actions       = var.pipeline_alarm_actions

  dimensions = {
    PipelineName = aws_codepipeline.main[0].name
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-pipeline-failed-alarm-${var.environment}"
    Environment = var.environment
  })
}

# Build failure alarm
resource "aws_cloudwatch_metric_alarm" "build_failed" {
  count = var.create_codepipeline && var.enable_pipeline_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-build-failed-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FailedBuilds"
  namespace           = "AWS/CodeBuild"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "CodeBuild build failed"
  alarm_actions       = var.pipeline_alarm_actions

  dimensions = {
    ProjectName = aws_codebuild_project.main[0].name
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-build-failed-alarm-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Data Sources
# =========================================

data "aws_caller_identity" "current" {}
