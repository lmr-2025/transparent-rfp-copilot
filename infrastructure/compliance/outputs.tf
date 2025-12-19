# Outputs for Compliance & Governance Infrastructure
# Reference: SEC-1061

# =========================================
# CloudTrail Outputs
# =========================================

output "cloudtrail_arn" {
  description = "ARN of the CloudTrail trail"
  value       = var.enable_cloudtrail ? aws_cloudtrail.main[0].arn : null
}

output "cloudtrail_name" {
  description = "Name of the CloudTrail trail"
  value       = var.enable_cloudtrail ? aws_cloudtrail.main[0].name : null
}

output "cloudtrail_bucket_name" {
  description = "Name of the S3 bucket for CloudTrail logs"
  value       = var.create_cloudtrail_bucket ? aws_s3_bucket.cloudtrail[0].id : var.existing_cloudtrail_bucket
}

output "cloudtrail_log_group_name" {
  description = "Name of the CloudWatch log group for CloudTrail"
  value       = var.enable_cloudtrail && var.cloudtrail_cloudwatch_logs ? aws_cloudwatch_log_group.cloudtrail[0].name : null
}

# =========================================
# AWS Config Outputs
# =========================================

output "config_recorder_name" {
  description = "Name of the AWS Config recorder"
  value       = var.enable_config ? aws_config_configuration_recorder.main[0].name : null
}

output "config_bucket_name" {
  description = "Name of the S3 bucket for AWS Config"
  value       = var.enable_config && var.create_config_bucket ? aws_s3_bucket.config[0].id : var.existing_config_bucket
}

output "config_role_arn" {
  description = "ARN of the IAM role for AWS Config"
  value       = var.enable_config ? aws_iam_role.config[0].arn : null
}

output "config_rules" {
  description = "List of AWS Config rules"
  value = var.enable_config && var.enable_config_rules ? [
    aws_config_config_rule.s3_bucket_encryption[0].name,
    aws_config_config_rule.rds_encryption[0].name,
    aws_config_config_rule.sg_ssh_restricted[0].name,
    aws_config_config_rule.iam_password_policy[0].name,
    aws_config_config_rule.root_mfa_enabled[0].name,
    aws_config_config_rule.cloudtrail_enabled[0].name,
  ] : []
}

# =========================================
# GuardDuty Outputs
# =========================================

output "guardduty_detector_id" {
  description = "ID of the GuardDuty detector"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].id : null
}

output "guardduty_detector_arn" {
  description = "ARN of the GuardDuty detector"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].arn : null
}

output "guardduty_topic_arn" {
  description = "ARN of the SNS topic for GuardDuty findings"
  value       = var.enable_guardduty && var.guardduty_notification_enabled ? aws_sns_topic.guardduty[0].arn : null
}

# =========================================
# Security Hub Outputs
# =========================================

output "security_hub_account_id" {
  description = "ID of the Security Hub account"
  value       = var.enable_security_hub ? aws_securityhub_account.main[0].id : null
}

output "security_hub_standards" {
  description = "List of enabled Security Hub standards"
  value = var.enable_security_hub ? [
    var.security_hub_enable_aws_foundational ? "AWS Foundational Security Best Practices" : null,
    var.security_hub_enable_cis ? "CIS AWS Foundations Benchmark" : null,
    var.security_hub_enable_pci_dss ? "PCI DSS" : null,
  ] : []
}

# =========================================
# Setup Instructions
# =========================================

output "setup_instructions" {
  description = "Next steps for compliance setup"
  value = <<-EOT
    ========================================
    COMPLIANCE SETUP INSTRUCTIONS
    ========================================

    ${var.enable_cloudtrail ? "✅ CloudTrail: Enabled" : "❌ CloudTrail: Disabled"}
    ${var.enable_config ? "✅ AWS Config: Enabled" : "❌ AWS Config: Disabled"}
    ${var.enable_guardduty ? "✅ GuardDuty: Enabled" : "❌ GuardDuty: Disabled"}
    ${var.enable_security_hub ? "✅ Security Hub: Enabled" : "❌ Security Hub: Disabled"}

    ${var.enable_cloudtrail ? "\n1. CloudTrail:\n   - View logs: aws s3 ls s3://${var.create_cloudtrail_bucket ? aws_s3_bucket.cloudtrail[0].id : var.existing_cloudtrail_bucket}/\n   - Search logs: aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=admin" : ""}

    ${var.enable_config ? "\n2. AWS Config:\n   - View compliance: https://console.aws.amazon.com/config/home?region=${var.aws_region}#/dashboard\n   - Check resource: aws configservice describe-compliance-by-resource --resource-type AWS::S3::Bucket" : ""}

    ${var.enable_guardduty ? "\n3. GuardDuty:\n   - View findings: https://console.aws.amazon.com/guardduty/home?region=${var.aws_region}#/findings\n   - List findings: aws guardduty list-findings --detector-id ${aws_guardduty_detector.main[0].id}\n   ${var.guardduty_notification_enabled ? "- Confirm SNS subscriptions: Check email and click confirmation links" : ""}" : ""}

    ${var.enable_security_hub ? "\n4. Security Hub:\n   - View dashboard: https://console.aws.amazon.com/securityhub/home?region=${var.aws_region}#/summary\n   - Get findings: aws securityhub get-findings --max-results 10" : ""}

    ========================================
  EOT
}

# =========================================
# Cost Estimate
# =========================================

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    cloudtrail = var.enable_cloudtrail ? (var.cloudtrail_s3_data_events || var.cloudtrail_lambda_data_events ? "$2-5 (with data events)" : "$2 (management events only)") : "$0"
    cloudtrail_insights = var.cloudtrail_enable_insights ? "$0.35 per 100,000 events" : "$0"
    config = var.enable_config ? "$2 + $0.003 per config item" : "$0"
    config_rules = var.enable_config && var.enable_config_rules ? "$2 per active rule ($12 for 6 rules)" : "$0"
    guardduty = var.enable_guardduty ? "$4.50 per million CloudTrail events analyzed" : "$0"
    security_hub = var.enable_security_hub ? "$0.0010 per security check (~$10-30/month)" : "$0"
    s3_storage = var.create_cloudtrail_bucket || var.create_config_bucket ? "$0.023 per GB" : "$0"
    total_minimum = var.enable_cloudtrail || var.enable_config || var.enable_guardduty ? "$5-30/month (depending on usage)" : "$0"
  }
}

# =========================================
# Testing Commands
# =========================================

output "testing_commands" {
  description = "Commands to test compliance setup"
  value = {
    cloudtrail_lookup = var.enable_cloudtrail ? "aws cloudtrail lookup-events --max-results 10" : "CloudTrail disabled"
    cloudtrail_status = var.enable_cloudtrail ? "aws cloudtrail get-trail-status --name ${aws_cloudtrail.main[0].name}" : "CloudTrail disabled"
    config_status = var.enable_config ? "aws configservice describe-configuration-recorder-status" : "Config disabled"
    config_compliance = var.enable_config && var.enable_config_rules ? "aws configservice describe-compliance-by-config-rule" : "Config rules disabled"
    guardduty_findings = var.enable_guardduty ? "aws guardduty list-findings --detector-id ${aws_guardduty_detector.main[0].id}" : "GuardDuty disabled"
    guardduty_stats = var.enable_guardduty ? "aws guardduty get-findings-statistics --detector-id ${aws_guardduty_detector.main[0].id} --finding-statistic-types COUNT_BY_SEVERITY" : "GuardDuty disabled"
    security_hub_summary = var.enable_security_hub ? "aws securityhub get-insights-results --insight-arn arn:aws:securityhub:${var.aws_region}:${data.aws_caller_identity.current.account_id}:insight/${data.aws_caller_identity.current.account_id}/default" : "Security Hub disabled"
    view_cloudtrail_logs = var.enable_cloudtrail && var.cloudtrail_cloudwatch_logs ? "aws logs tail ${aws_cloudwatch_log_group.cloudtrail[0].name} --follow" : "CloudWatch Logs disabled"
  }
}

# =========================================
# Compliance Status
# =========================================

output "compliance_status" {
  description = "Summary of enabled compliance features"
  value = {
    audit_logging          = var.enable_cloudtrail
    multi_region_trail     = var.cloudtrail_multi_region
    log_file_validation    = var.enable_cloudtrail
    cloudwatch_integration = var.cloudtrail_cloudwatch_logs
    resource_compliance    = var.enable_config
    config_rules           = var.enable_config && var.enable_config_rules
    threat_detection       = var.enable_guardduty
    security_standards     = var.enable_security_hub
    automated_remediation  = false # Would need AWS Systems Manager for this
  }
}

# =========================================
# Data Sources
# =========================================

data "aws_caller_identity" "current" {}
