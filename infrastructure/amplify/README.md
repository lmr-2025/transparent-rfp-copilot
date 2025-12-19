# AWS Amplify Infrastructure for Transparent Trust

AWS Amplify Hosting infrastructure for deploying the Transparent Trust Next.js application with automatic builds, preview deployments, and custom domains.

**Reference**: [SEC-1048 - AWS Amplify deployment](https://linear.app/montecarlodata/issue/SEC-1048)

## Overview

This Terraform module provisions AWS Amplify Hosting for Next.js, offering a simpler alternative to ECS/Fargate with:

- **Automatic Builds** from GitHub on every push
- **Pull Request Previews** for testing changes before merging
- **Custom Domains** with automatic SSL certificates
- **Branch Deployments** for staging, development, and feature branches
- **Built-in CDN** with global edge locations
- **Server-Side Rendering** (SSR) support for Next.js
- **Environment Variables** with Parameter Store integration
- **Basic Authentication** for non-production environments

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  main   │  │ staging │  │   PR    │                     │
│  └────┬────┘  └────┬────┘  └────┬────┘                     │
└───────┼───────────┼────────────┼────────────────────────────┘
        │           │            │
        │  Push     │  Push      │  Pull Request
        ▼           ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS Amplify Hosting                             │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Production   │ │  Staging     │ │  PR Preview  │       │
│  │ main branch  │ │ Branch       │ │ Ephemeral    │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌──────────────────────────────────────────────────┐      │
│  │          Amplify Build Process                   │      │
│  │  1. npm ci                                       │      │
│  │  2. npx prisma generate                         │      │
│  │  3. npm run build                                │      │
│  │  4. Deploy to CDN                                │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudFront CDN                              │
│         (Automatic SSL, Global Distribution)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   End Users    │
              │                │
              │  https://      │
              │  app.example   │
              │  .com          │
              └────────────────┘

           Integrations:
    ┌─────────────────────────┐
    │ Parameter Store         │
    │ - Secrets               │
    │ - API Keys              │
    │ - Database URL          │
    └─────────────────────────┘
              │
              ▼
    ┌─────────────────────────┐
    │ RDS PostgreSQL          │
    │ S3 Buckets              │
    │ Upstash Redis           │
    └─────────────────────────┘
```

## Features

### Core Capabilities

- **Git-Based Workflow**: Automatic deployments on push to any branch
- **Next.js Optimized**: Full SSR, ISR, and API routes support
- **Zero Configuration**: Works out-of-the-box with Next.js projects
- **Preview Deployments**: Automatic preview URLs for every pull request
- **Instant Rollbacks**: One-click rollback to previous deployments
- **Environment Management**: Separate environments for production, staging, development

### Developer Experience

- **Fast Builds**: Cached dependencies and incremental builds
- **Real-Time Logs**: View build and deployment logs in console
- **Build Notifications**: Email or SNS notifications on build status
- **Custom Redirects**: Flexible routing and rewrite rules
- **Basic Auth**: Password-protect staging and preview environments

### Infrastructure

- **Managed Service**: No servers to manage, fully serverless
- **Auto-Scaling**: Automatically scales to handle traffic
- **Global CDN**: Content delivery from edge locations worldwide
- **SSL Certificates**: Automatic SSL/TLS certificates with AWS Certificate Manager
- **DDoS Protection**: AWS Shield Standard included

## Amplify vs. ECS/Fargate

| Feature | Amplify | ECS/Fargate |
|---------|---------|-------------|
| **Complexity** | Low - Fully managed | Medium - More configuration |
| **Setup Time** | Minutes | Hours |
| **Server Management** | None | Minimal (Fargate) |
| **Cost (small app)** | ~$15-30/month | ~$30-50/month |
| **Scaling** | Automatic | Manual + Auto-scaling |
| **CI/CD** | Built-in | Requires setup (GitHub Actions) |
| **Custom Domains** | Easy | Requires ALB + Route 53 |
| **PR Previews** | Built-in | Not available |
| **Deployment Speed** | 3-5 minutes | 5-10 minutes |
| **Best For** | Simple apps, MVPs, prototypes | Complex apps, microservices |
| **Database Access** | Via public endpoint or VPC | VPC integration available |
| **Customization** | Limited | Full control |

**Recommendation**: Use Amplify for simpler deployments and faster iterations. Use ECS/Fargate for production applications requiring VPC integration, custom networking, or specific infrastructure requirements.

## Prerequisites

Before using this module, ensure you have:

1. **GitHub Repository**:
   - Next.js application in GitHub
   - GitHub personal access token with repo access

2. **IAM Role**:
   - Amplify service role with permissions for:
     - Parameter Store (for secrets)
     - CloudWatch Logs
     - S3 (if using file uploads)

3. **Secrets in Parameter Store**:
   - Database credentials
   - API keys
   - Authentication secrets
   - See "Secrets Management" section below

4. **Custom Domain** (optional):
   - Domain registered in Route 53 or external registrar
   - DNS access for verification

## Variables

### Required Variables

| Variable | Description | Type |
|----------|-------------|------|
| `repository_url` | GitHub repository URL | string |
| `github_access_token` | GitHub personal access token | string (sensitive) |
| `amplify_service_role_arn` | ARN of IAM role for Amplify | string |
| `basic_auth_password` | Password for basic auth | string (sensitive) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project name for resources | `transparent-trust` |
| `environment` | Environment name | `production` |
| `main_branch_name` | Main branch to deploy | `main` |
| `enable_pr_previews` | Enable PR preview deployments | `true` |
| `custom_domain` | Custom domain (e.g., example.com) | `""` (uses amplifyapp.com) |
| `enable_alarms` | Enable CloudWatch alarms | `true` |
| `environment_variables` | App environment variables | `{}` |

See [variables.tf](./variables.tf) for complete list.

## Outputs

| Output | Description |
|--------|-------------|
| `app_id` | Amplify app ID |
| `main_branch_url` | URL of main branch deployment |
| `default_domain` | Default amplifyapp.com domain |
| `custom_domain_url` | Custom domain URL (if configured) |
| `webhook_url` | Webhook URL for manual deployments |
| `parameter_store_paths` | Recommended paths for secrets |
| `useful_commands` | Quick reference AWS CLI commands |

See [outputs.tf](./outputs.tf) for complete list.

## Usage

### Basic Setup

```hcl
module "amplify" {
  source = "./infrastructure/amplify"

  # Repository
  repository_url       = "https://github.com/your-org/transparent-trust"
  github_access_token  = var.github_token  # Store in Terraform Cloud/Vault

  # IAM
  amplify_service_role_arn = aws_iam_role.amplify_service.arn

  # Authentication
  basic_auth_username = "admin"
  basic_auth_password = var.basic_auth_password  # Store securely

  # Configuration
  environment      = "production"
  main_branch_name = "main"

  # Features
  enable_pr_previews = true
  enable_alarms      = true
}
```

### Production Configuration

```hcl
module "amplify" {
  source = "./infrastructure/amplify"

  repository_url       = "https://github.com/your-org/transparent-trust"
  github_access_token  = var.github_token
  amplify_service_role_arn = aws_iam_role.amplify_service.arn

  # Production settings
  environment      = "production"
  main_branch_name = "main"

  # Custom domain
  custom_domain = "app.example.com"
  domain_prefix = ""  # Use apex domain

  # Additional branches
  additional_branches = {
    staging = {
      stage                 = "BETA"
      enable_pr_previews    = false
      enable_basic_auth     = true
    }
  }

  # No basic auth on production main branch
  enable_basic_auth_for_main = false
  basic_auth_username        = "admin"
  basic_auth_password        = var.basic_auth_password

  # Environment variables (non-sensitive)
  environment_variables = {
    NEXT_PUBLIC_APP_URL = "https://app.example.com"
    NEXT_PUBLIC_ENV     = "production"
  }

  # Monitoring
  enable_alarms       = true
  alarm_sns_topic_arn = aws_sns_topic.alerts.arn

  tags = {
    Project     = "transparent-trust"
    Environment = "production"
    CostCenter  = "engineering"
  }
}
```

### Multi-Environment Setup

```hcl
# Production
module "amplify_production" {
  source = "./infrastructure/amplify"

  repository_url       = "https://github.com/your-org/transparent-trust"
  github_access_token  = var.github_token
  amplify_service_role_arn = aws_iam_role.amplify_service.arn

  environment      = "production"
  main_branch_name = "main"
  custom_domain    = "app.example.com"

  enable_basic_auth_for_main = false
  basic_auth_password        = var.basic_auth_password
}

# Staging
module "amplify_staging" {
  source = "./infrastructure/amplify"

  repository_url       = "https://github.com/your-org/transparent-trust"
  github_access_token  = var.github_token
  amplify_service_role_arn = aws_iam_role.amplify_service.arn

  environment      = "staging"
  main_branch_name = "staging"
  custom_domain    = "staging.example.com"

  enable_basic_auth_for_main = true
  basic_auth_username        = "admin"
  basic_auth_password        = var.basic_auth_password
}
```

## Deployment Workflow

### 1. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (all)
4. Copy token and store securely

### 2. Create IAM Role for Amplify

```hcl
resource "aws_iam_role" "amplify_service" {
  name = "amplify-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "amplify.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

# Attach policies for Parameter Store, S3, etc.
resource "aws_iam_role_policy" "amplify_secrets" {
  role = aws_iam_role.amplify_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/amplify/${var.project_name}/*"
      }
    ]
  })
}
```

### 3. Store Secrets in Parameter Store

```bash
# Database URL
aws ssm put-parameter \
  --name "/amplify/transparent-trust/production/DATABASE_URL" \
  --value "postgresql://user:password@rds-endpoint:5432/dbname" \
  --type "SecureString" \
  --description "Database connection URL"

# NextAuth Secret
aws ssm put-parameter \
  --name "/amplify/transparent-trust/production/NEXTAUTH_SECRET" \
  --value "your-secret-key-here" \
  --type "SecureString" \
  --description "NextAuth.js secret"

# Anthropic API Key
aws ssm put-parameter \
  --name "/amplify/transparent-trust/production/ANTHROPIC_API_KEY" \
  --value "sk-ant-..." \
  --type "SecureString" \
  --description "Claude API key"

# Continue for all secrets...
```

### 4. Update next.config.ts

Ensure your Next.js config supports Amplify:

```typescript
const nextConfig = {
  // Amplify uses standalone output
  output: 'standalone',
  
  // Other config...
};

export default nextConfig;
```

### 5. Provision Infrastructure

```bash
cd infrastructure/amplify
terraform init
terraform plan -var="environment=production"
terraform apply -var="environment=production"
```

### 6. Configure Environment Variables in Amplify

After Terraform creates the app, configure Parameter Store references:

```bash
# Get app ID from Terraform output
APP_ID=$(terraform output -raw app_id)

# Set environment variable to reference Parameter Store
aws amplify update-app \
  --app-id $APP_ID \
  --environment-variables \
    AMPLIFY_DATABASE_URL=/amplify/transparent-trust/production/DATABASE_URL \
    AMPLIFY_NEXTAUTH_SECRET=/amplify/transparent-trust/production/NEXTAUTH_SECRET \
    AMPLIFY_ANTHROPIC_API_KEY=/amplify/transparent-trust/production/ANTHROPIC_API_KEY
```

**Note**: Environment variables with the `AMPLIFY_` prefix automatically pull values from Parameter Store.

### 7. Trigger First Deployment

```bash
# Manual deployment via CLI
aws amplify start-job \
  --app-id $APP_ID \
  --branch-name main \
  --job-type RELEASE

# Or simply push to GitHub
git push origin main
```

### 8. Access Application

```bash
# Get the URL
terraform output main_branch_url

# Example: https://main.d1234abcdef.amplifyapp.com
```

## Secrets Management

Amplify uses AWS Systems Manager Parameter Store for secrets.

### Parameter Store Naming Convention

```
/amplify/{project-name}/{environment}/{SECRET_NAME}
```

Example:
```
/amplify/transparent-trust/production/DATABASE_URL
/amplify/transparent-trust/production/NEXTAUTH_SECRET
/amplify/transparent-trust/staging/DATABASE_URL
```

### Accessing Secrets in Amplify

1. **Create Parameter in Parameter Store**:
   ```bash
   aws ssm put-parameter \
     --name "/amplify/transparent-trust/production/MY_SECRET" \
     --value "secret-value" \
     --type "SecureString"
   ```

2. **Reference in Amplify Environment Variable**:
   - Variable name: `AMPLIFY_MY_SECRET`
   - Variable value: `/amplify/transparent-trust/production/MY_SECRET`

3. **Access in Application**:
   ```typescript
   // Amplify automatically resolves AMPLIFY_ prefixed variables
   const mySecret = process.env.MY_SECRET;  // Note: no AMPLIFY_ prefix in code
   ```

### Required Secrets

| Secret Name | Parameter Store Path | Description |
|-------------|---------------------|-------------|
| `DATABASE_URL` | `/amplify/transparent-trust/production/DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | `/amplify/transparent-trust/production/NEXTAUTH_SECRET` | NextAuth.js encryption key |
| `NEXTAUTH_URL` | `/amplify/transparent-trust/production/NEXTAUTH_URL` | Public URL (e.g., https://app.example.com) |
| `ANTHROPIC_API_KEY` | `/amplify/transparent-trust/production/ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_CLIENT_ID` | `/amplify/transparent-trust/production/GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `/amplify/transparent-trust/production/GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `UPSTASH_REDIS_REST_URL` | `/amplify/transparent-trust/production/UPSTASH_REDIS_REST_URL` | Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | `/amplify/transparent-trust/production/UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `ENCRYPTION_KEY` | `/amplify/transparent-trust/production/ENCRYPTION_KEY` | App settings encryption |

## Custom Domain Setup

### 1. Add Domain to Amplify

Already configured in Terraform:

```hcl
custom_domain = "app.example.com"
domain_prefix = ""  # Empty for apex domain, or "www" for subdomain
```

### 2. Get DNS Verification Records

```bash
# Get certificate verification record
aws amplify get-domain-association \
  --app-id $(terraform output -raw app_id) \
  --domain-name app.example.com \
  --query 'domainAssociation.certificateVerificationDNSRecord'
```

### 3. Add DNS Records

Add the CNAME records provided by Amplify to your DNS provider:

```
# Certificate verification
_abc123.app.example.com CNAME _def456.acm-validations.aws

# Amplify domain
app.example.com CNAME main.d1234abcdef.amplifyapp.com
```

### 4. Wait for Verification

```bash
# Check status
aws amplify get-domain-association \
  --app-id $(terraform output -raw app_id) \
  --domain-name app.example.com \
  --query 'domainAssociation.domainStatus'
```

Status progression: `CREATING` → `REQUESTING_CERTIFICATE` → `PENDING_VERIFICATION` → `PENDING_DEPLOYMENT` → `AVAILABLE`

## Pull Request Previews

When enabled, Amplify automatically creates a preview deployment for every pull request.

### How It Works

1. Developer creates PR in GitHub
2. Amplify detects PR and starts build
3. Unique preview URL is generated: `https://pr-123.d1234abcdef.amplifyapp.com`
4. GitHub comment added with preview URL
5. Preview updates on every push to PR
6. Preview is deleted when PR is merged/closed

### Configuration

```hcl
enable_pr_previews = true
pr_environment_name = "pr"

# Enable basic auth for PR previews
enable_basic_auth_for_branches = true
basic_auth_username            = "admin"
basic_auth_password            = var.basic_auth_password
```

### Benefits

- **Test Before Merge**: Review changes in production-like environment
- **Share with Team**: Send preview URL to stakeholders
- **Visual QA**: Catch UI/UX issues before merging
- **No Local Setup**: Team members can test without local dev environment

## Branch Deployments

Deploy multiple branches for different environments:

```hcl
additional_branches = {
  staging = {
    stage                 = "BETA"
    enable_pr_previews    = false
    enable_basic_auth     = true
    environment_variables = {
      NEXT_PUBLIC_ENV = "staging"
    }
  }
  
  develop = {
    stage                 = "DEVELOPMENT"
    enable_pr_previews    = true
    enable_basic_auth     = true
    environment_variables = {
      NEXT_PUBLIC_ENV = "development"
    }
  }
}
```

Each branch gets its own URL:
- Production: `https://main.d1234abcdef.amplifyapp.com`
- Staging: `https://staging.d1234abcdef.amplifyapp.com`
- Development: `https://develop.d1234abcdef.amplifyapp.com`

## Cost Estimation

### Amplify Pricing (us-east-1)

| Resource | Price | Notes |
|----------|-------|-------|
| **Build minutes** | $0.01 per minute | First 1,000 minutes/month free |
| **Hosting (storage)** | $0.023 per GB/month | First 15 GB free |
| **Data transfer out** | $0.15 per GB | First 15 GB free |

### Example Monthly Costs

**Small App** (10 builds/month, 1 GB storage, 10 GB transfer):
- Build: 10 builds × 5 min × $0.01 = $0.50
- Storage: Free (under 15 GB)
- Transfer: Free (under 15 GB)
- **Total: ~$0.50/month** (essentially free tier)

**Medium App** (50 builds/month, 5 GB storage, 50 GB transfer):
- Build: (50 × 5 - 1000 free) = -750 minutes = $0 (still free tier)
- Storage: Free
- Transfer: (50 - 15) × $0.15 = $5.25
- **Total: ~$5/month**

**Active Development** (200 builds/month, 10 GB storage, 100 GB transfer):
- Build: (200 × 5 - 1000 free) = 0 minutes (just under free tier)
- Storage: Free
- Transfer: (100 - 15) × $0.15 = $12.75
- **Total: ~$13/month**

**Production** (100 builds/month, 20 GB storage, 200 GB transfer):
- Build: Free (under 1000 min)
- Storage: (20 - 15) × $0.023 = $0.12
- Transfer: (200 - 15) × $0.15 = $27.75
- **Total: ~$28/month**

### Cost Optimization Tips

1. **Use Build Caching**: Speeds up builds and reduces minutes
2. **Optimize Images**: Reduces storage and bandwidth costs
3. **CDN Caching**: Reduces data transfer costs
4. **Delete Old Branches**: Remove stale branch deployments
5. **Limit PR Previews**: Only enable for important branches
6. **Monitor Usage**: Set up billing alerts

## Monitoring

### CloudWatch Metrics

Amplify publishes metrics to CloudWatch:

- **BuildSuccesses**: Number of successful builds
- **BuildFailures**: Number of failed builds
- **BuildDuration**: Time to complete builds
- **DeploymentDuration**: Time to deploy to CDN
- **Requests**: Number of HTTP requests
- **BytesDownloaded**: Data transfer out

### Pre-Configured Alarms

This module creates:

1. **Build Failures**: Alerts when any build fails
2. **Slow Deployments**: Alerts when deployment takes > 10 minutes

### Viewing Logs

```bash
# View build logs in console
aws amplify get-job \
  --app-id $(terraform output -raw app_id) \
  --branch-name main \
  --job-id <job-id>

# Or use the AWS Console:
# https://console.aws.amazon.com/amplify/home#/<app-id>
```

### Build Notifications

Set up SNS topic for notifications:

```hcl
alarm_sns_topic_arn = aws_sns_topic.amplify_notifications.arn
```

Subscribe to email or Slack:

```bash
# Email subscription
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:amplify-notifications \
  --protocol email \
  --notification-endpoint team@example.com
```

## Troubleshooting

### Common Issues

#### 1. Build Fails with "Module not found"

**Cause**: Missing dependencies or incorrect Node version

**Solution**:
```yaml
# Update build spec in Terraform
custom_build_spec = <<-EOT
  version: 1
  frontend:
    phases:
      preBuild:
        commands:
          - nvm use 18  # Specify Node version
          - npm ci --legacy-peer-deps
          - npx prisma generate
      build:
        commands:
          - npm run build
EOT
```

#### 2. Environment Variables Not Working

**Cause**: Incorrect Parameter Store path or missing IAM permissions

**Solution**:
```bash
# Verify parameter exists
aws ssm get-parameter --name "/amplify/transparent-trust/production/MY_SECRET"

# Check IAM role has access
aws iam get-role-policy --role-name amplify-service-role --policy-name amplify-secrets

# Ensure variable name has AMPLIFY_ prefix
# Variable: AMPLIFY_MY_SECRET
# Reference: /amplify/transparent-trust/production/MY_SECRET
```

#### 3. Custom Domain Not Working

**Cause**: DNS records not configured or certificate validation pending

**Solution**:
```bash
# Check domain status
aws amplify get-domain-association \
  --app-id <app-id> \
  --domain-name app.example.com

# Verify DNS records are correct
dig _verification.app.example.com CNAME
dig app.example.com CNAME

# Wait for certificate (can take 15-30 minutes)
```

#### 4. Database Connection Fails

**Cause**: RDS in VPC, Amplify cannot access private endpoints

**Solution**:
- Use RDS proxy with public endpoint
- Use bastion host with port forwarding
- Migrate to Supabase, PlanetScale, or Neon (serverless databases with public endpoints)
- **Or use ECS/Fargate** (SEC-1047) which supports VPC integration

#### 5. Build Takes Too Long

**Cause**: No caching, installing all dependencies every time

**Solution**:
```yaml
# Enable caching in build spec
cache:
  paths:
    - node_modules/**/*
    - .next/cache/**/*
```

### Debug Build Issues

1. **View Build Logs**:
   ```bash
   # Get latest job
   aws amplify list-jobs \
     --app-id <app-id> \
     --branch-name main \
     --max-results 1

   # View job details
   aws amplify get-job \
     --app-id <app-id> \
     --branch-name main \
     --job-id <job-id>
   ```

2. **Test Build Locally**:
   ```bash
   # Simulate Amplify build
   rm -rf node_modules .next
   npm ci --legacy-peer-deps
   npx prisma generate
   npm run build
   ```

3. **Check Environment Variables**:
   ```bash
   # List all environment variables
   aws amplify get-app --app-id <app-id> \
     --query 'app.environmentVariables'
   ```

## Limitations

### Amplify Limitations

1. **No VPC Integration**: Cannot directly access private resources (RDS in VPC)
2. **Build Timeouts**: Maximum build time is 30 minutes
3. **Cold Starts**: SSR functions have cold start latency (~1-2s)
4. **Custom Domains**: Must use Route 53 or external DNS (cannot use ALB)
5. **No WebSockets**: Limited real-time capabilities
6. **Memory Limits**: SSR functions limited to 3008 MB memory
7. **Concurrent Builds**: Limited concurrent builds per account
8. **No Container Control**: Cannot customize container/runtime environment

### When to Use ECS/Fargate Instead

Use ECS/Fargate (SEC-1047) if you need:
- VPC integration for private RDS/Redis
- WebSocket support for real-time features
- Custom networking or security groups
- Container-level control
- No cold starts
- Long-running processes
- More than 3 GB memory per function

## Security Best Practices

1. **Use Parameter Store for Secrets**: Never hardcode secrets in environment variables
2. **Enable Basic Auth for Non-Prod**: Protect staging/dev environments
3. **Disable PR Previews for Security**: If PRs contain sensitive changes
4. **Rotate Secrets Regularly**: Update Parameter Store values periodically
5. **Use IAM Least Privilege**: Grant only required permissions
6. **Enable CloudTrail**: Audit all Amplify API calls
7. **Review Build Logs**: Check for exposed secrets in logs
8. **Use Signed URLs for S3**: Don't expose S3 bucket publicly

## Related Documentation

- [AWS Amplify Hosting Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/)
- [Next.js on Amplify](https://docs.amplify.aws/guides/hosting/nextjs)
- [Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Custom Domains on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)
- [ECS/Fargate Alternative](../ecs/README.md) (SEC-1047)

## Support

For issues or questions:
- **Linear**: [SEC-1048](https://linear.app/montecarlodata/issue/SEC-1048)
- **AWS Support**: Check AWS Support Center
- **Terraform**: [Amplify Module Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/amplify_app)
