# VPC Infrastructure

This directory contains Terraform configurations for the VPC network infrastructure for the Transparent Trust application.

**Linear Issue**: [SEC-1051 - VPC and Subnets](https://linear.app/montecarlodata/issue/SEC-1051)

## Overview

This module creates a production-ready VPC with:
- Multi-AZ high availability
- Public and private subnets
- NAT Gateways for private subnet internet access
- VPC Flow Logs for network monitoring
- Proper route table configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          VPC (10.0.0.0/16)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐       ┌──────────────────────┐      │
│  │   us-east-1a         │       │   us-east-1b         │      │
│  ├──────────────────────┤       ├──────────────────────┤      │
│  │ Public: 10.0.0.0/24  │       │ Public: 10.0.1.0/24  │      │
│  │ - ALB                │       │ - ALB                │      │
│  │ - NAT Gateway        │       │ - NAT Gateway        │      │
│  └──────────────────────┘       └──────────────────────┘      │
│           │                              │                     │
│           │                              │                     │
│  ┌──────────────────────┐       ┌──────────────────────┐      │
│  │ Private: 10.0.3.0/24 │       │ Private: 10.0.4.0/24 │      │
│  │ - ECS Tasks          │       │ - ECS Tasks          │      │
│  │ - RDS                │       │ - RDS (standby)      │      │
│  │ - ElastiCache        │       │ - ElastiCache        │      │
│  └──────────────────────┘       └──────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                  Internet Gateway
                          │
                      Internet
```

## Resources Created

### Core Networking
- **VPC**: Single VPC with customizable CIDR (default: 10.0.0.0/16)
- **Internet Gateway**: Allows public subnet internet access
- **Public Subnets**: 2-3 subnets across multiple AZs for load balancers and NAT gateways
- **Private Subnets**: 2-3 subnets across multiple AZs for applications and databases
- **NAT Gateways**: One per AZ for high availability (optional)
- **Elastic IPs**: For NAT Gateways

### Routing
- **Public Route Table**: Routes traffic to Internet Gateway
- **Private Route Tables**: One per AZ, routes traffic to NAT Gateway
- **Route Table Associations**: Links subnets to appropriate route tables

### Monitoring
- **VPC Flow Logs**: Network traffic logging to CloudWatch
- **CloudWatch Log Group**: Stores VPC Flow Logs
- **IAM Role**: Allows VPC to write flow logs to CloudWatch

## Subnet Allocation

| Subnet Type | AZ | CIDR | Usage |
|-------------|-----|------|-------|
| Public | us-east-1a | 10.0.0.0/24 | ALB, NAT Gateway |
| Public | us-east-1b | 10.0.1.0/24 | ALB, NAT Gateway |
| Public | us-east-1c | 10.0.2.0/24 | ALB, NAT Gateway |
| Private | us-east-1a | 10.0.3.0/24 | ECS, RDS, ElastiCache |
| Private | us-east-1b | 10.0.4.0/24 | ECS, RDS, ElastiCache |
| Private | us-east-1c | 10.0.5.0/24 | ECS, RDS, ElastiCache |

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_name` | Project name for tagging | `transparent-trust` | No |
| `environment` | Environment (production/staging/development) | `production` | No |
| `aws_region` | AWS region | `us-east-1` | No |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` | No |
| `availability_zones` | List of AZs to use | `["us-east-1a", "us-east-1b", "us-east-1c"]` | No |
| `enable_nat_gateway` | Create NAT Gateways | `true` | No |
| `enable_flow_logs` | Enable VPC Flow Logs | `true` | No |
| `flow_logs_traffic_type` | Traffic to log (ACCEPT/REJECT/ALL) | `ALL` | No |
| `flow_logs_retention_days` | Flow logs retention | `30` | No |
| `flow_logs_aggregation_interval` | Aggregation interval (60/600 seconds) | `600` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `vpc_id` | VPC ID |
| `vpc_cidr` | VPC CIDR block |
| `public_subnet_ids` | List of public subnet IDs |
| `private_subnet_ids` | List of private subnet IDs |
| `nat_gateway_ids` | List of NAT Gateway IDs |
| `nat_gateway_public_ips` | NAT Gateway public IPs |
| `vpc_flow_log_id` | VPC Flow Log ID |
| `vpc_summary` | Summary of VPC configuration |

## Deployment

### Prerequisites

```bash
# Install Terraform
brew install terraform

# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### Deploy VPC

```bash
# Navigate to VPC directory
cd infrastructure/vpc

# Initialize Terraform
terraform init

# Review planned changes
terraform plan \
  -var="environment=production" \
  -var="aws_region=us-east-1"

# Apply configuration
terraform apply \
  -var="environment=production" \
  -var="aws_region=us-east-1"

# Save outputs for use in other modules
terraform output -json > vpc-outputs.json
```

### Production Deployment

```bash
terraform apply \
  -var="environment=production" \
  -var="vpc_cidr=10.0.0.0/16" \
  -var='availability_zones=["us-east-1a","us-east-1b","us-east-1c"]' \
  -var="enable_nat_gateway=true" \
  -var="enable_flow_logs=true"
```

### Cost-Optimized Development

```bash
# Use 2 AZs and single NAT Gateway
terraform apply \
  -var="environment=development" \
  -var='availability_zones=["us-east-1a","us-east-1b"]' \
  -var="enable_nat_gateway=true" \
  -var="enable_flow_logs=false"
```

### Disable NAT Gateway (Use Upstash/Public Services)

```bash
# No NAT Gateway if app doesn't need outbound internet from private subnets
terraform apply \
  -var="environment=production" \
  -var="enable_nat_gateway=false"
```

## Cost Estimates

Rough monthly costs for production (us-east-1):

| Resource | Configuration | Est. Monthly Cost |
|----------|---------------|-------------------|
| NAT Gateway (3 AZs) | Standard | ~$105 ($35 × 3) |
| Elastic IPs (3) | Associated | ~$0 |
| VPC Flow Logs | 30-day retention, moderate traffic | ~$5-10 |
| Data Transfer | 100GB outbound through NAT | ~$9 |
| **Total** | | **~$120-125/month** |

**Cost Optimization Options**:
- **Single NAT Gateway**: ~$35/month (loses multi-AZ redundancy)
- **No NAT Gateway**: $0 (use Upstash for Redis, public APIs only)
- **Disable Flow Logs**: Save ~$5-10/month (loses network visibility)

## Verification

### Check VPC

```bash
# List VPCs
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=transparent-trust" \
  --query 'Vpcs[*].[VpcId,CidrBlock,Tags[?Key==`Name`].Value|[0]]' \
  --output table

# Check VPC attributes
aws ec2 describe-vpc-attribute \
  --vpc-id $(terraform output -raw vpc_id) \
  --attribute enableDnsSupport

aws ec2 describe-vpc-attribute \
  --vpc-id $(terraform output -raw vpc_id) \
  --attribute enableDnsHostnames
```

### Check Subnets

```bash
# List subnets
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

### Check NAT Gateways

```bash
# List NAT Gateways
aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'NatGateways[*].[NatGatewayId,State,SubnetId,NatGatewayAddresses[0].PublicIp]' \
  --output table
```

### Check VPC Flow Logs

```bash
# Describe flow logs
aws ec2 describe-flow-logs \
  --filter "Name=resource-id,Values=$(terraform output -raw vpc_id)" \
  --query 'FlowLogs[*].[FlowLogId,FlowLogStatus,TrafficType,LogDestinationType]' \
  --output table

# View recent flow logs
aws logs tail $(terraform output -raw vpc_flow_log_group_name) --follow
```

## Security Considerations

### Network Isolation
- **Public subnets**: Only for load balancers and NAT gateways
- **Private subnets**: All application and database resources
- **No direct internet access**: Private resources route through NAT Gateway

### VPC Flow Logs
- Monitor all network traffic (ACCEPT, REJECT, or ALL)
- Detect unusual patterns or potential threats
- Meet compliance requirements for network logging

### DNS Configuration
- **DNS hostnames enabled**: Resources get DNS names
- **DNS support enabled**: Resources can resolve DNS names
- Required for RDS, ElastiCache, and service discovery

## Troubleshooting

### Private Subnet Can't Access Internet

**Symptom**: Resources in private subnet can't reach internet (e.g., can't pull Docker images, can't call external APIs)

**Solution**:
```bash
# Check NAT Gateway status
aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'NatGateways[*].[NatGatewayId,State]'

# Check route table has route to NAT Gateway
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'RouteTables[*].Routes'

# Verify NAT Gateway is in public subnet
aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'NatGateways[*].[NatGatewayId,SubnetId]'
```

### VPC Flow Logs Not Appearing

**Symptom**: No flow logs in CloudWatch

**Solution**:
```bash
# Check flow log status
aws ec2 describe-flow-logs \
  --filter "Name=resource-id,Values=$(terraform output -raw vpc_id)"

# Check IAM role has correct permissions
aws iam get-role-policy \
  --role-name $(aws ec2 describe-flow-logs --filter "Name=resource-id,Values=$(terraform output -raw vpc_id)" --query 'FlowLogs[0].DeliverLogsPermissionArn' --output text | cut -d'/' -f2) \
  --policy-name transparent-trust-vpc-flow-logs-policy-production
```

### Subnet IP Exhaustion

**Symptom**: Can't launch resources, "insufficient IP addresses" error

**Solution**:
```bash
# Check available IPs per subnet
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'Subnets[*].[SubnetId,AvailableIpAddressCount,CidrBlock]' \
  --output table

# Consider:
# - Adding more subnets
# - Using larger CIDR blocks (/23 instead of /24)
# - Cleaning up unused ENIs
```

## Integration with Other Modules

### Use VPC Outputs in ECS Module

```hcl
# In infrastructure/ecs/main.tf
data "terraform_remote_state" "vpc" {
  backend = "local"
  config = {
    path = "../vpc/terraform.tfstate"
  }
}

resource "aws_ecs_service" "app" {
  network_configuration {
    subnets = data.terraform_remote_state.vpc.outputs.private_subnet_ids
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}
```

### Use VPC Outputs in RDS Module

```hcl
# In infrastructure/rds/main.tf
data "terraform_remote_state" "vpc" {
  backend = "local"
  config = {
    path = "../vpc/terraform.tfstate"
  }
}

resource "aws_db_subnet_group" "main" {
  subnet_ids = data.terraform_remote_state.vpc.outputs.private_subnet_ids
}
```

## Maintenance

### Update Terraform

```bash
# Update providers
terraform init -upgrade

# Review changes
terraform plan

# Apply updates
terraform apply
```

### Add Additional Availability Zone

```bash
# Update availability_zones variable
terraform apply \
  -var='availability_zones=["us-east-1a","us-east-1b","us-east-1c","us-east-1d"]'

# This will create new subnets and NAT Gateway in the new AZ
```

### Migrate to Different CIDR

```bash
# WARNING: This requires recreating the VPC
# Save current state
terraform state pull > vpc-state-backup.json

# Update CIDR
terraform apply -var="vpc_cidr=10.1.0.0/16"

# This will destroy and recreate the VPC
# All resources in the VPC will need to be recreated
```

## Related Documentation

- [AWS_DEPLOYMENT.md](../../docs/AWS_DEPLOYMENT.md) - Full deployment guide
- [Phase 2.1 - VPC and Subnets](../../docs/AWS_DEPLOYMENT.md#21-vpc-and-subnets-sec-1051)
- [AWS VPC Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-best-practices.html)
- [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)

## Support

For questions or issues:
- Linear: [SEC-1051](https://linear.app/montecarlodata/issue/SEC-1051)
- Repository: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
