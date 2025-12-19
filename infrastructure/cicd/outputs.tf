# Outputs for CI/CD Infrastructure
# Reference: SEC-1060

# =========================================
# ECR Outputs
# =========================================

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = var.create_ecr_repository ? aws_ecr_repository.main[0].repository_url : var.existing_ecr_repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = var.create_ecr_repository ? aws_ecr_repository.main[0].arn : null
}

output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = var.create_ecr_repository ? aws_ecr_repository.main[0].name : null
}

# =========================================
# CodePipeline Outputs
# =========================================

output "pipeline_name" {
  description = "Name of the CodePipeline"
  value       = var.create_codepipeline ? aws_codepipeline.main[0].name : null
}

output "pipeline_arn" {
  description = "ARN of the CodePipeline"
  value       = var.create_codepipeline ? aws_codepipeline.main[0].arn : null
}

output "pipeline_url" {
  description = "URL to view the CodePipeline in AWS Console"
  value       = var.create_codepipeline ? "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${aws_codepipeline.main[0].name}/view?region=${var.aws_region}" : null
}

# =========================================
# CodeBuild Outputs
# =========================================

output "codebuild_project_name" {
  description = "Name of the CodeBuild project"
  value       = var.create_codepipeline ? aws_codebuild_project.main[0].name : null
}

output "codebuild_project_arn" {
  description = "ARN of the CodeBuild project"
  value       = var.create_codepipeline ? aws_codebuild_project.main[0].arn : null
}

output "codebuild_log_group_name" {
  description = "Name of the CodeBuild CloudWatch log group"
  value       = var.create_codepipeline ? aws_cloudwatch_log_group.codebuild[0].name : null
}

# =========================================
# S3 Outputs
# =========================================

output "artifacts_bucket_name" {
  description = "Name of the S3 bucket for pipeline artifacts"
  value       = var.create_codepipeline ? aws_s3_bucket.pipeline_artifacts[0].bucket : null
}

output "artifacts_bucket_arn" {
  description = "ARN of the S3 bucket for pipeline artifacts"
  value       = var.create_codepipeline ? aws_s3_bucket.pipeline_artifacts[0].arn : null
}

# =========================================
# IAM Outputs
# =========================================

output "codebuild_role_arn" {
  description = "ARN of the CodeBuild IAM role"
  value       = var.create_codepipeline ? aws_iam_role.codebuild[0].arn : null
}

output "codepipeline_role_arn" {
  description = "ARN of the CodePipeline IAM role"
  value       = var.create_codepipeline ? aws_iam_role.codepipeline[0].arn : null
}

# =========================================
# GitHub Actions Configuration
# =========================================

output "github_actions_ecr_push_command" {
  description = "Command to push Docker image to ECR from GitHub Actions"
  value       = var.create_ecr_repository ? "docker push ${aws_ecr_repository.main[0].repository_url}:$IMAGE_TAG" : null
}

output "github_actions_iam_policy" {
  description = "IAM policy JSON for GitHub Actions OIDC role"
  value = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
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
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}

# =========================================
# Setup Instructions
# =========================================

output "setup_instructions" {
  description = "Next steps for CI/CD setup"
  value = var.create_codepipeline ? <<-EOT
    ========================================
    CODEPIPELINE SETUP INSTRUCTIONS
    ========================================

    1. Create CodeStar Connection to GitHub:
       aws codestar-connections create-connection \
         --provider-type GitHub \
         --connection-name ${var.project_name}-github

    2. Authorize the connection in AWS Console:
       https://console.aws.amazon.com/codesuite/settings/connections

    3. Update terraform.tfvars with connection ARN:
       codestar_connection_arn = "arn:aws:codestar-connections:..."

    4. Apply Terraform again to create pipeline

    5. Push to ${var.github_branch} branch to trigger deployment

    View pipeline:
    ${var.create_codepipeline ? "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${aws_codepipeline.main[0].name}/view?region=${var.aws_region}" : "N/A"}

    ========================================
  EOT
  : <<-EOT
    ========================================
    GITHUB ACTIONS SETUP INSTRUCTIONS
    ========================================

    1. Create GitHub Actions workflow file:
       .github/workflows/deploy.yml

    2. Configure GitHub repository secrets:
       - AWS_ACCOUNT_ID: ${data.aws_caller_identity.current.account_id}
       - AWS_REGION: ${var.aws_region}
       - ECR_REPOSITORY: ${var.create_ecr_repository ? aws_ecr_repository.main[0].repository_url : "N/A"}

    3. Set up AWS IAM OIDC provider for GitHub:
       See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

    4. Push to main branch to trigger deployment

    ========================================
  EOT
}

# =========================================
# Cost Estimate
# =========================================

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    ecr                  = var.create_ecr_repository ? "$0.10 per GB stored (first 500 MB free)" : "$0"
    codepipeline         = var.create_codepipeline ? "$1 per active pipeline" : "$0"
    codebuild            = var.create_codepipeline ? "$0.005 per build minute (BUILD_GENERAL1_SMALL)" : "$0"
    s3_artifacts         = var.create_codepipeline ? "$0.023 per GB stored + $0.005 per 1000 requests" : "$0"
    cloudwatch_logs      = "$0.50 per GB ingested (first 5 GB free)"
    github_actions       = "$0 (2000 free minutes/month for public repos, 3000 for Pro accounts)"
    total_minimum        = var.create_codepipeline ? "$1-5/month (CodePipeline) or $0 (GitHub Actions only)" : "$0 (GitHub Actions only)"
    cost_per_deployment  = var.create_codepipeline ? "~$0.10 per deployment (5-10 min build)" : "$0"
  }
}

# =========================================
# Testing Commands
# =========================================

output "testing_commands" {
  description = "Commands to test the CI/CD setup"
  value = {
    view_ecr_images         = var.create_ecr_repository ? "aws ecr describe-images --repository-name ${aws_ecr_repository.main[0].name}" : "N/A"
    trigger_pipeline        = var.create_codepipeline ? "aws codepipeline start-pipeline-execution --name ${aws_codepipeline.main[0].name}" : "N/A"
    view_pipeline_status    = var.create_codepipeline ? "aws codepipeline get-pipeline-state --name ${aws_codepipeline.main[0].name}" : "N/A"
    view_build_logs         = var.create_codepipeline ? "aws logs tail /aws/codebuild/${var.project_name}-${var.environment} --follow" : "N/A"
    list_pipeline_artifacts = var.create_codepipeline ? "aws s3 ls s3://${aws_s3_bucket.pipeline_artifacts[0].bucket}/" : "N/A"
    push_image_manually     = var.create_ecr_repository ? "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.main[0].repository_url} && docker push ${aws_ecr_repository.main[0].repository_url}:latest" : "N/A"
  }
}
