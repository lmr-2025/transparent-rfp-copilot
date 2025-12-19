# CI/CD Infrastructure for Transparent Trust

Complete CI/CD infrastructure supporting both AWS CodePipeline and GitHub Actions for automated deployment of the Transparent Trust Next.js application.

**Reference**: [SEC-1060 - CI/CD Pipeline](https://linear.app/montecarlodata/issue/SEC-1060)

## Overview

This module provides two CI/CD options:
- **GitHub Actions** (Recommended): Free, flexible, fast setup
- **AWS CodePipeline**: Native AWS integration, more control

Both options support:
- Automated Docker builds and pushes to Amazon ECR
- Deployment to ECS/Fargate or AWS Amplify
- Database migrations with Prisma
- Image vulnerability scanning
- Build caching for faster deployments
- CloudWatch monitoring and alarms

## Architecture Options

### Option 1: GitHub Actions (Recommended)
```
GitHub → GitHub Actions → ECR → ECS/Fargate
```
- **Cost**: $0 (2000 free minutes/month)
- **Setup**: 10 minutes
- **Pros**: Free, fast, flexible, great UI
- **Cons**: Requires GitHub

### Option 2: AWS CodePipeline
```
GitHub → CodePipeline → CodeBuild → ECR → ECS/Fargate
```
- **Cost**: ~$1-5/month
- **Setup**: 20 minutes
- **Pros**: Native AWS, no external dependencies
- **Cons**: Costs money, slower UI

## Quick Start

### Prerequisites
1. GitHub repository
2. AWS account with appropriate IAM permissions
3. ECR repository (created by this module or existing)
4. ECS cluster and service (for ECS deployment) or Amplify app (for Amplify)

### Option 1: GitHub Actions Setup

#### Step 1: Create Terraform Infrastructure

```hcl
module "cicd" {
  source = "./infrastructure/cicd"

  project_name = "transparent-trust"
  environment  = "production"

  # Create ECR repository
  create_ecr_repository = true
  ecr_scan_on_push      = true

  # Disable CodePipeline (using GitHub Actions)
  create_codepipeline = false

  tags = {
    Project = "transparent-trust"
  }
}
```

#### Step 2: Set Up AWS OIDC Provider for GitHub

```bash
# Create OIDC provider (one-time setup)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create IAM role for GitHub Actions
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
        }
      }
    }]
  }'

# Attach policy (get from Terraform output)
aws iam put-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-name DeployPolicy \
  --policy-document "$(terraform output -raw github_actions_iam_policy)"
```

#### Step 3: Add GitHub Workflow

Copy the workflow file to your repository:
```bash
mkdir -p .github/workflows
cp infrastructure/cicd/github-actions/deploy-ecs.yml .github/workflows/
# Or for Amplify:
# cp infrastructure/cicd/github-actions/deploy-amplify.yml .github/workflows/
```

Edit the workflow and update:
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `ECS_TASK_DEFINITION`

#### Step 4: Configure GitHub Secrets

Add these secrets in GitHub Settings → Secrets and variables → Actions:
- `AWS_ROLE_ARN`: ARN of GitHubActionsDeployRole
- `AWS_REGION`: `us-east-1`

#### Step 5: Deploy!

```bash
git add .github/workflows/deploy-ecs.yml
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

GitHub Actions will automatically build and deploy!

### Option 2: AWS CodePipeline Setup

#### Step 1: Create CodeStar Connection to GitHub

```bash
# Create connection
aws codestar-connections create-connection \
  --provider-type GitHub \
  --connection-name transparent-trust-github

# Output will include connection ARN
```

Go to AWS Console → CodePipeline → Settings → Connections and click "Update pending connection" to authorize GitHub access.

#### Step 2: Create Terraform Infrastructure

```hcl
module "cicd" {
  source = "./infrastructure/cicd"

  project_name = "transparent-trust"
  environment  = "production"

  # ECR configuration
  create_ecr_repository = true
  ecr_scan_on_push      = true

  # CodePipeline configuration
  create_codepipeline     = true
  codestar_connection_arn = "arn:aws:codestar-connections:us-east-1:ACCOUNT_ID:connection/CONNECTION_ID"
  github_repository       = "your-org/transparent-trust"
  github_branch           = "main"

  # Deployment configuration
  deploy_to_ecs    = true
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name

  # Secrets
  secrets_manager_arns = [
    module.secrets.database_credentials_arn,
    module.secrets.nextauth_secret_arn
  ]

  # Monitoring
  enable_pipeline_alarms = true
  pipeline_alarm_actions = [module.monitoring.critical_alert_topic_arn]

  tags = {
    Project = "transparent-trust"
  }
}
```

#### Step 3: Apply Terraform

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

#### Step 4: Trigger Deployment

Push to your main branch:
```bash
git push origin main
```

View pipeline status:
```bash
aws codepipeline get-pipeline-state \
  --name transparent-trust-pipeline-production
```

## Configuration Options

### ECR Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `create_ecr_repository` | Create new ECR repository | `true` |
| `ecr_scan_on_push` | Scan images for vulnerabilities | `true` |
| `ecr_image_tag_mutability` | Allow tag overwrites | `MUTABLE` |
| `ecr_keep_image_count` | Number of tagged images to keep | `10` |
| `ecr_untagged_expiration_days` | Days to keep untagged images | `7` |

### CodeBuild Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `codebuild_compute_type` | Build instance size | `BUILD_GENERAL1_SMALL` |
| `codebuild_image` | Docker image for builds | `aws/codebuild/standard:7.0` |
| `codebuild_timeout_minutes` | Build timeout | `20` |
| `codebuild_cache_type` | Cache type (S3, LOCAL, NO_CACHE) | `S3` |

**Compute Types**:
- `BUILD_GENERAL1_SMALL`: 3 GB RAM, 2 vCPU - $0.005/min
- `BUILD_GENERAL1_MEDIUM`: 7 GB RAM, 4 vCPU - $0.01/min
- `BUILD_GENERAL1_LARGE`: 15 GB RAM, 8 vCPU - $0.02/min

### Pipeline Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `create_codepipeline` | Enable CodePipeline | `false` |
| `github_repository` | GitHub repo (owner/name) | Required |
| `github_branch` | Branch to deploy from | `main` |
| `deploy_to_ecs` | Deploy to ECS (vs Amplify) | `true` |

## Custom Build Specification

### Default buildspec.yml

The module includes a default buildspec for Next.js + Docker:

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - aws ecr get-login-password | docker login ...
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}

  build:
    commands:
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG

  post_build:
    commands:
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - printf '[{"name":"app","imageUri":"%s"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
```

### Custom Buildspec

Override with your own:

```hcl
module "cicd" {
  # ... other config ...

  custom_buildspec = file("${path.module}/custom-buildspec.yml")
}
```

Or include in your repository as `buildspec.yml` at the root.

### Buildspec with Database Migrations

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      # ... ECR login ...
      # Get DATABASE_URL from Secrets Manager
      - export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id transparent-trust/production/DATABASE_URL --query SecretString --output text)

  build:
    commands:
      # Run migrations before building
      - npm ci --legacy-peer-deps
      - npx prisma migrate deploy
      - npx prisma generate

      # Build Docker image
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG

  post_build:
    commands:
      # ... push images ...
```

## Deployment Strategies

### Blue/Green Deployment

For zero-downtime deployments:

```hcl
# In ECS module
resource "aws_ecs_service" "main" {
  deployment_controller {
    type = "CODE_DEPLOY"
  }
}

# Add CodeDeploy stage to pipeline
module "cicd" {
  # ... existing config ...

  # CodeDeploy will handle blue/green
  deploy_to_ecs = false
}
```

### Canary Deployment

Gradually roll out new versions:

```yaml
# In ECS service
deployment_configuration {
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  maximum_percent         = 200
  minimum_healthy_percent = 100
}
```

## Monitoring and Alarms

The module automatically creates CloudWatch alarms for:

### Pipeline Failures
```
PipelineExecutionFailure > 0
```
Notifies when pipeline fails.

### Build Failures
```
FailedBuilds > 0
```
Notifies when CodeBuild fails.

### View Logs

```bash
# CodeBuild logs
aws logs tail /aws/codebuild/transparent-trust-production --follow

# Pipeline execution history
aws codepipeline list-pipeline-executions \
  --pipeline-name transparent-trust-pipeline-production

# Detailed execution
aws codepipeline get-pipeline-execution \
  --pipeline-name transparent-trust-pipeline-production \
  --pipeline-execution-id EXECUTION_ID
```

## Cost Breakdown

### GitHub Actions (Recommended)
| Service | Cost |
|---------|------|
| GitHub Actions | $0 (2000 free minutes/month) |
| ECR Storage | $0.10 per GB/month |
| ECR Data Transfer | $0.09 per GB out |
| **Total** | **~$0-2/month** |

**Example**: 10 deployments/month × 5 min/build = 50 minutes (free)

### AWS CodePipeline
| Service | Cost |
|---------|------|
| CodePipeline | $1 per active pipeline/month |
| CodeBuild | $0.005 per build minute (small) |
| S3 Artifacts | $0.023 per GB stored |
| ECR Storage | $0.10 per GB/month |
| **Total** | **$1-5/month** |

**Example**: 10 deployments/month × 5 min/build = $1 + $0.25 = $1.25/month

## Testing

### Test ECR Push

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push test image
docker build -t transparent-trust-production:test .
docker tag transparent-trust-production:test \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:test
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:test

# Verify image
aws ecr describe-images \
  --repository-name transparent-trust-production \
  --image-ids imageTag=test
```

### Test Pipeline Manually

```bash
# Trigger pipeline
aws codepipeline start-pipeline-execution \
  --name transparent-trust-pipeline-production

# Watch progress
aws codepipeline get-pipeline-state \
  --name transparent-trust-pipeline-production \
  | jq '.stageStates[] | {name: .stageName, status: .latestExecution.status}'
```

### Test GitHub Actions Locally

Use [act](https://github.com/nektos/act) to test workflows locally:

```bash
# Install act
brew install act

# Run workflow
act -j deploy --secret-file .env.secrets
```

## Troubleshooting

### ECR: "no basic auth credentials"

**Issue**: Docker can't authenticate with ECR

**Solution**:
```bash
# Get fresh ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### CodeBuild: "Access denied to secrets"

**Issue**: CodeBuild can't read Secrets Manager

**Solution**:
Add secrets ARNs to `secrets_manager_arns` variable:
```hcl
secrets_manager_arns = [
  "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:transparent-trust/*"
]
```

### Pipeline: "Insufficient permissions"

**Issue**: CodePipeline can't deploy to ECS

**Solution**:
The module automatically grants necessary permissions. Verify:
```bash
aws iam get-role-policy \
  --role-name transparent-trust-codepipeline-role-production \
  --policy-name transparent-trust-codepipeline-role-production
```

### GitHub Actions: "Unable to assume role"

**Issue**: OIDC authentication failing

**Solution**:
1. Verify OIDC provider exists:
   ```bash
   aws iam list-open-id-connect-providers
   ```
2. Check trust relationship on IAM role matches repository
3. Ensure `id-token: write` permission in workflow

### Build: "Docker daemon not running"

**Issue**: CodeBuild can't build Docker images

**Solution**:
Set `privileged_mode = true` in CodeBuild environment (already default in this module).

## Security Best Practices

1. **Use OIDC for GitHub Actions** - No long-lived credentials
2. **Enable image scanning** - Detect vulnerabilities in images
3. **Use immutable tags** - Prevent tag overwrites in production
4. **Rotate access keys** - If using access keys, rotate monthly
5. **Limit IAM permissions** - Grant minimum required permissions
6. **Encrypt artifacts** - S3 artifact bucket uses encryption
7. **Monitor failed builds** - CloudWatch alarms on failures
8. **Use VPC endpoints** - Reduce data transfer costs and improve security

## Migration from Other CI/CD

### From CircleCI

1. Copy your `.circleci/config.yml` logic to GitHub Actions YAML
2. Update AWS authentication to use OIDC
3. Replace CircleCI secrets with GitHub secrets
4. Test deployment

### From Jenkins

1. Convert Jenkinsfile to GitHub Actions workflow
2. Replace Jenkins credentials with GitHub secrets
3. Set up AWS OIDC provider
4. Test pipeline

### From GitLab CI

1. Convert `.gitlab-ci.yml` to `.github/workflows/deploy.yml`
2. Update authentication method
3. Configure GitHub secrets
4. Test deployment

## Related Documentation

- [GitHub Actions AWS Guide](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS CodePipeline](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeBuild](https://docs.aws.amazon.com/codebuild/)
- [Amazon ECR](https://docs.aws.amazon.com/ecr/)
- [ECS Deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)

## Support

For issues: [SEC-1060](https://linear.app/montecarlodata/issue/SEC-1060)
