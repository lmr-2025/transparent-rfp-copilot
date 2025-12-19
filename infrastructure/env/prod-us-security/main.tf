# Production US Security Environment
# Terraform configuration for deploying transparent-rfp-copilot infrastructure

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure backend for state management
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "prod-us-security/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Workspace   = "prod-us-security"
    }
  }
}

# =========================================
# VPC Module
# =========================================

module "vpc" {
  source = "../../modules/vpc"

  project_name     = var.project_name
  environment      = var.environment
  aws_region       = var.aws_region
  vpc_cidr         = var.vpc_cidr
  availability_zones = var.availability_zones

  enable_nat_gateway = var.enable_nat_gateway
  enable_flow_logs   = var.enable_flow_logs
  enable_dns_hostnames = true
  enable_dns_support   = true

  flow_logs_retention_days = 90
}

# =========================================
# Security Groups Module
# =========================================

module "security_groups" {
  source = "../../modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  vpc_cidr     = var.vpc_cidr  # Pass VPC CIDR for security group rules

  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids

  enable_redis = var.enable_elasticache_redis
}

# =========================================
# S3 Module
# =========================================

module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  enable_versioning = var.s3_enable_versioning
  enable_lifecycle  = var.s3_enable_lifecycle

  lifecycle_transition_days = 90
  lifecycle_expiration_days = 730

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.vpc]
}

# =========================================
# S3 Policies Module
# =========================================

module "s3_policies" {
  source = "../../modules/s3-policies"

  project_name        = var.project_name
  environment         = var.environment
  uploads_bucket_name = module.s3.uploads_bucket_name
  logs_bucket_name    = module.s3.logs_bucket_name

  depends_on = [module.s3]
}

# =========================================
# IAM Module
# =========================================

module "iam" {
  source = "../../modules/iam"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  s3_bucket_arns = [
    module.s3.uploads_bucket_arn,
    module.s3.logs_bucket_arn
  ]

  enable_xray = var.enable_xray_tracing

  depends_on = [module.s3]
}

# =========================================
# Secrets Manager Module
# =========================================

module "secrets_manager" {
  source = "../../modules/secrets-manager"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  enable_redis = var.enable_elasticache_redis

  # Secrets will need to be populated manually or via separate process
  nextauth_secret    = var.nextauth_secret
  anthropic_api_key  = var.anthropic_api_key
  google_client_id   = var.google_client_id
  google_client_secret = var.google_client_secret
  encryption_key     = var.encryption_key

  enable_rotation = var.enable_secret_rotation
  enable_alarms   = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""
}

# =========================================
# RDS Module
# =========================================

module "rds" {
  source = "../../modules/rds"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.rds_security_group_id]

  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  engine_version    = var.rds_engine_version

  database_name = var.rds_database_name
  master_username = var.rds_master_username

  multi_az               = var.rds_multi_az
  backup_retention_period = var.rds_backup_retention_period
  enable_enhanced_monitoring = var.rds_enable_enhanced_monitoring
  enable_performance_insights = var.rds_enable_performance_insights

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.vpc, module.security_groups]
}

# =========================================
# Redis Module (ElastiCache)
# =========================================

module "redis" {
  count  = var.enable_elasticache_redis ? 1 : 0
  source = "../../modules/redis"

  project_name = var.project_name
  environment  = var.environment

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.redis_security_group_id]

  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  parameter_group_family = var.redis_parameter_group_family

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.vpc, module.security_groups, module.secrets_manager]
}

# =========================================
# ALB Module - Internal for Tailscale Access
# =========================================
# CONFIGURED FOR TAILSCALE-ONLY ACCESS:
# - Internal ALB (internal = true)
# - Uses private subnets (no public internet access)
# - Security group allows traffic from VPC CIDR only
# - DNS: transparent-trust-prod.mcdinternal.io (A record in Route53)

module "alb" {
  source = "../../modules/alb"

  project_name = var.project_name
  environment  = var.environment

  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids  # Internal ALB in private subnets
  alb_security_group_id = module.security_groups.alb_security_group_id

  certificate_arn = var.alb_certificate_arn
  enable_https    = var.alb_enable_https

  health_check_path     = var.alb_health_check_path
  health_check_interval = 30
  health_check_timeout  = 5

  enable_alb_alarms    = false  # Alarms created in monitoring module to avoid circular dependency
  alarm_sns_topic_arns = []

  depends_on = [module.vpc, module.security_groups, module.s3]
}

# =========================================
# DNS & CDN Module
# =========================================

module "dns_cdn" {
  count  = var.enable_dns_cdn ? 1 : 0
  source = "../../modules/dns-cdn"

  project_name = var.project_name
  environment  = var.environment

  domain_name        = var.domain_name
  create_hosted_zone = var.create_hosted_zone
  hosted_zone_id     = var.hosted_zone_id

  alb_dns_name    = module.alb.alb_dns_name
  alb_zone_id     = module.alb.alb_zone_id

  enable_cloudfront = var.enable_cloudfront
  enable_waf        = var.enable_waf

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.alb]
}

# =========================================
# ECS Module
# =========================================

module "ecs" {
  count  = var.deployment_type == "ecs" ? 1 : 0
  source = "../../modules/ecs"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id
  target_group_arn    = module.alb.target_group_arn

  ecs_execution_role_arn = module.iam.ecs_execution_role_arn
  ecs_task_role_arn      = module.iam.ecs_task_role_arn

  task_cpu    = var.ecs_task_cpu
  task_memory = var.ecs_task_memory

  desired_count = var.ecs_desired_count
  enable_autoscaling = var.ecs_enable_autoscaling
  autoscaling_min_capacity = var.ecs_autoscaling_min_capacity
  autoscaling_max_capacity = var.ecs_autoscaling_max_capacity

  database_secret_arn    = module.rds.db_credentials_secret_arn
  nextauth_secret_arn    = module.secrets_manager.nextauth_secret_arn
  anthropic_secret_arn   = module.secrets_manager.anthropic_api_key_secret_arn
  google_oauth_secret_arn = module.secrets_manager.google_oauth_secret_arn
  encryption_key_secret_arn = module.secrets_manager.encryption_key_secret_arn
  redis_secret_arn       = var.enable_elasticache_redis ? module.secrets_manager.redis_secret_arn : ""

  nextauth_url = var.nextauth_url

  enable_execute_command = var.ecs_enable_execute_command
  use_fargate_spot       = var.ecs_use_fargate_spot

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.alb, module.rds, module.secrets_manager, module.iam]
}

# =========================================
# Amplify Module (Alternative to ECS)
# =========================================

module "amplify" {
  count  = var.deployment_type == "amplify" ? 1 : 0
  source = "../../modules/amplify"

  project_name = var.project_name
  environment  = var.environment

  repository_url = var.amplify_repository_url
  branch_name    = var.amplify_branch_name

  domain_name = var.domain_name
  enable_custom_domain = var.amplify_enable_custom_domain

  environment_variables = merge(
    {
      DATABASE_URL = "postgresql://${var.rds_master_username}@${module.rds.db_instance_endpoint}/${var.rds_database_name}"
      NEXTAUTH_URL = var.nextauth_url
    },
    var.amplify_environment_variables
  )

  enable_basic_auth = var.amplify_enable_basic_auth
  basic_auth_username = var.amplify_basic_auth_username
  basic_auth_password = var.amplify_basic_auth_password

  enable_alarms       = var.enable_monitoring
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].critical_sns_topic_arn : ""

  depends_on = [module.rds, module.secrets_manager]
}

# =========================================
# Monitoring Module
# =========================================

module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = var.environment

  alert_email        = var.monitoring_alert_email
  slack_webhook_url  = var.monitoring_slack_webhook_url

  create_dashboard = var.monitoring_create_dashboard

  # Pass resource identifiers for monitoring
  ecs_cluster_name = var.deployment_type == "ecs" ? module.ecs[0].cluster_name : ""
  ecs_service_name = var.deployment_type == "ecs" ? module.ecs[0].service_name : ""
  alb_arn_suffix   = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  rds_instance_id  = module.rds.db_instance_id

  depends_on = [module.ecs, module.alb, module.rds]
}
