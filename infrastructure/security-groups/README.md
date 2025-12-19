# Security Groups and Network ACLs

This directory contains Terraform configurations for security groups and network ACLs for the Transparent Trust application.

**Linear Issue**: [SEC-1053 - Security Groups and NACLs](https://linear.app/montecarlodata/issue/SEC-1053)

## Overview

This module creates security groups following the principle of least privilege with defense-in-depth using Network ACLs:
- Application Load Balancer security group
- Application/ECS container security group
- RDS PostgreSQL security group
- ElastiCache Redis security group (optional)
- VPC endpoints security group (optional)
- Network ACLs for public and private subnets (optional)

## Architecture

```
                    Internet
                        │
                        ▼
            ┌───────────────────────┐
            │   ALB Security Group  │
            │   ┌─────────────────┐ │
            │   │ Inbound:        │ │
            │   │ • 0.0.0.0/0:443 │ │
            │   │ • 0.0.0.0/0:80  │ │
            │   └─────────────────┘ │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   App Security Group  │
            │   ┌─────────────────┐ │
            │   │ Inbound:        │ │
            │   │ • ALB SG:3000   │ │
            │   │                 │ │
            │   │ Outbound:       │ │
            │   │ • Internet      │ │
            │   │ • RDS SG:5432   │ │
            │   │ • Redis SG:6379 │ │
            │   └─────────────────┘ │
            └─────┬─────────┬───────┘
                  │         │
         ┌────────┘         └────────┐
         ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│ RDS Sec Group    │      │ Redis Sec Group  │
│ ┌──────────────┐ │      │ ┌──────────────┐ │
│ │ Inbound:     │ │      │ │ Inbound:     │ │
│ │ • App:5432   │ │      │ │ • App:6379   │ │
│ └──────────────┘ │      │ └──────────────┘ │
└──────────────────┘      └──────────────────┘
```

## Security Groups Created

### 1. ALB Security Group
**Name**: `transparent-trust-alb-sg-{environment}`
**Purpose**: Allows HTTPS/HTTP traffic from the internet to the Application Load Balancer

| Direction | Protocol | Port | Source/Destination | Description |
|-----------|----------|------|-------------------|-------------|
| Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS from internet |
| Inbound | TCP | 80 | 0.0.0.0/0 | HTTP from internet (optional, redirects to HTTPS) |
| Outbound | TCP | 3000 | App SG | Forward traffic to application containers |

---

### 2. Application Security Group
**Name**: `transparent-trust-app-sg-{environment}`
**Purpose**: Protects ECS/Fargate application containers

| Direction | Protocol | Port | Source/Destination | Description |
|-----------|----------|------|-------------------|-------------|
| Inbound | TCP | 3000 | ALB SG | Receive traffic from ALB |
| Outbound | All | All | 0.0.0.0/0 | Internet access (API calls, package downloads) |
| Outbound | TCP | 5432 | RDS SG | Database connections |
| Outbound | TCP | 6379 | Redis SG | Cache connections (if enabled) |

---

### 3. RDS Security Group
**Name**: `transparent-trust-rds-sg-{environment}`
**Purpose**: Protects PostgreSQL database

| Direction | Protocol | Port | Source/Destination | Description |
|-----------|----------|------|-------------------|-------------|
| Inbound | TCP | 5432 | App SG | PostgreSQL from application only |

**Note**: No outbound rules - RDS doesn't initiate connections

---

### 4. Redis Security Group (Optional)
**Name**: `transparent-trust-redis-sg-{environment}`
**Purpose**: Protects ElastiCache Redis cluster

| Direction | Protocol | Port | Source/Destination | Description |
|-----------|----------|------|-------------------|-------------|
| Inbound | TCP | 6379 | App SG | Redis from application only |

**Note**: No outbound rules - Redis doesn't initiate connections

---

### 5. VPC Endpoints Security Group (Optional)
**Name**: `transparent-trust-vpc-endpoints-sg-{environment}`
**Purpose**: Allows application to access AWS services via VPC endpoints

| Direction | Protocol | Port | Source/Destination | Description |
|-----------|----------|------|-------------------|-------------|
| Inbound | TCP | 443 | App SG | HTTPS from application to AWS services |

---

## Network ACLs (Optional)

Network ACLs provide an additional layer of defense at the subnet level.

### Public Subnet NACL

**Inbound Rules**:
| Rule # | Protocol | Port | Source | Action | Purpose |
|--------|----------|------|--------|--------|---------|
| 100 | TCP | 443 | 0.0.0.0/0 | ALLOW | HTTPS traffic |
| 110 | TCP | 80 | 0.0.0.0/0 | ALLOW | HTTP traffic (optional) |
| 200 | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW | Return traffic (ephemeral ports) |

**Outbound Rules**:
| Rule # | Protocol | Port | Destination | Action | Purpose |
|--------|----------|------|-------------|--------|---------|
| 100 | TCP | 80 | 0.0.0.0/0 | ALLOW | HTTP to internet |
| 110 | TCP | 443 | 0.0.0.0/0 | ALLOW | HTTPS to internet |
| 200 | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW | Return traffic |

### Private Subnet NACL

**Inbound Rules**:
| Rule # | Protocol | Port | Source | Action | Purpose |
|--------|----------|------|--------|--------|---------|
| 100 | TCP | 3000 | VPC CIDR | ALLOW | Application traffic |
| 110 | TCP | 5432 | VPC CIDR | ALLOW | PostgreSQL traffic |
| 120 | TCP | 6379 | VPC CIDR | ALLOW | Redis traffic (optional) |
| 200 | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW | Return traffic |

**Outbound Rules**:
| Rule # | Protocol | Port | Destination | Action | Purpose |
|--------|----------|------|-------------|--------|---------|
| 100 | TCP | 80 | 0.0.0.0/0 | ALLOW | HTTP to internet (via NAT) |
| 110 | TCP | 443 | 0.0.0.0/0 | ALLOW | HTTPS to internet (via NAT) |
| 120 | TCP | 5432 | VPC CIDR | ALLOW | PostgreSQL traffic |
| 130 | TCP | 6379 | VPC CIDR | ALLOW | Redis traffic (optional) |
| 200 | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW | Return traffic |

---

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_name` | Project name for tagging | `transparent-trust` | No |
| `environment` | Environment (production/staging/development) | `production` | No |
| `vpc_id` | VPC ID where security groups will be created | - | Yes |
| `vpc_cidr` | CIDR block of the VPC | `10.0.0.0/16` | No |
| `public_subnet_ids` | List of public subnet IDs | - | Yes (if NACLs enabled) |
| `private_subnet_ids` | List of private subnet IDs | - | Yes (if NACLs enabled) |
| `app_port` | Application listen port | `3000` | No |
| `allow_http_to_alb` | Allow HTTP to ALB | `true` | No |
| `enable_redis` | Create Redis security group | `false` | No |
| `enable_vpc_endpoints` | Create VPC endpoints security group | `false` | No |
| `enable_custom_nacls` | Create custom Network ACLs | `false` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `alb_security_group_id` | ALB security group ID |
| `app_security_group_id` | Application security group ID |
| `rds_security_group_id` | RDS security group ID |
| `redis_security_group_id` | Redis security group ID (if enabled) |
| `vpc_endpoints_security_group_id` | VPC endpoints security group ID (if enabled) |
| `public_nacl_id` | Public NACL ID (if enabled) |
| `private_nacl_id` | Private NACL ID (if enabled) |

## Deployment

### Prerequisites

```bash
# VPC module must be deployed first
cd ../vpc
terraform apply
```

### Deploy Security Groups

```bash
# Navigate to security-groups directory
cd infrastructure/security-groups

# Initialize Terraform
terraform init

# Set VPC ID from VPC module
VPC_ID=$(cd ../vpc && terraform output -raw vpc_id)

# Review planned changes
terraform plan \
  -var="vpc_id=$VPC_ID" \
  -var="environment=production"

# Apply configuration
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="environment=production"
```

### Production Deployment (Without Redis)

```bash
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="environment=production" \
  -var="enable_redis=false" \
  -var="enable_custom_nacls=false"
```

### Production Deployment (With Redis and NACLs)

```bash
# Get subnet IDs
PUBLIC_SUBNETS=$(cd ../vpc && terraform output -json public_subnet_ids)
PRIVATE_SUBNETS=$(cd ../vpc && terraform output -json private_subnet_ids)

terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="environment=production" \
  -var="enable_redis=true" \
  -var="enable_custom_nacls=true" \
  -var="public_subnet_ids=$PUBLIC_SUBNETS" \
  -var="private_subnet_ids=$PRIVATE_SUBNETS"
```

## Security Best Practices

### 1. Least Privilege
- Security groups only allow necessary traffic
- Each tier (ALB, app, database) has its own security group
- Database and cache only accept connections from application

### 2. Defense in Depth
- Security groups (stateful, instance-level)
- Network ACLs (stateless, subnet-level) - optional but recommended
- Multiple layers ensure that if one fails, others still protect

### 3. No Direct Internet Access to Private Resources
- Only ALB is internet-facing
- Application, database, and cache are in private subnets
- Application accesses internet via NAT Gateway

### 4. Reference Security Groups, Not IP Ranges
- Using security group references (not CIDR blocks) means:
  - Automatic updates when instances change
  - No IP range management
  - More secure and maintainable

### 5. Explicit Deny by Default
- Security groups deny all traffic by default
- Only explicitly allowed traffic is permitted
- No need to create deny rules

## Verification

### Check Security Groups

```bash
# List security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Project,Values=transparent-trust" \
  --query 'SecurityGroups[*].[GroupId,GroupName,Description]' \
  --output table

# Check ALB security group rules
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(terraform output -raw alb_security_group_id)" \
  --query 'SecurityGroupRules[*].[IsEgress,IpProtocol,FromPort,ToPort,CidrIpv4,ReferencedGroupInfo.GroupId]' \
  --output table
```

### Check Network ACLs

```bash
# List NACLs
aws ec2 describe-network-acls \
  --filters "Name=tag:Project,Values=transparent-trust" \
  --query 'NetworkAcls[*].[NetworkAclId,Tags[?Key==`Name`].Value|[0],Associations[*].SubnetId]' \
  --output table

# Check NACL rules
aws ec2 describe-network-acls \
  --network-acl-ids $(terraform output -raw public_nacl_id) \
  --query 'NetworkAcls[0].Entries' \
  --output table
```

### Test Connectivity

```bash
# Test from ALB to app (should succeed)
# This requires instances/services to be running

# Test direct access to RDS from internet (should fail)
nc -zv <rds-endpoint> 5432  # Should timeout

# Test app to RDS (should succeed from within app container)
psql -h <rds-endpoint> -U <username> -d <database>
```

## Troubleshooting

### Application Can't Connect to Database

**Symptoms**: Connection timeout or connection refused errors

**Checks**:
```bash
# 1. Verify security group allows app to RDS
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(terraform output -raw rds_security_group_id)" \
  --query 'SecurityGroupRules[?!IsEgress]'

# 2. Verify app is using correct security group
aws ecs describe-services \
  --cluster <cluster-name> \
  --services <service-name> \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups'

# 3. Check if RDS is in private subnet
aws rds describe-db-instances \
  --db-instance-identifier <db-id> \
  --query 'DBInstances[0].DBSubnetGroup.Subnets[*].[SubnetIdentifier,SubnetAvailabilityZone.Name]'
```

### ALB Can't Reach Application

**Symptoms**: 504 Gateway Timeout or target unhealthy

**Checks**:
```bash
# 1. Verify ALB can egress to app security group
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(terraform output -raw alb_security_group_id)" \
  --query 'SecurityGroupRules[?IsEgress]'

# 2. Verify app allows ingress from ALB
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(terraform output -raw app_security_group_id)" \
  --query 'SecurityGroupRules[?!IsEgress]'

# 3. Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

### Network ACL Blocking Traffic

**Symptoms**: Intermittent connectivity issues, some traffic works but not all

**Checks**:
```bash
# Check NACL rules for subnet
SUBNET_ID=<your-subnet-id>
NACL_ID=$(aws ec2 describe-network-acls \
  --filters "Name=association.subnet-id,Values=$SUBNET_ID" \
  --query 'NetworkAcls[0].NetworkAclId' \
  --output text)

aws ec2 describe-network-acls \
  --network-acl-ids $NACL_ID \
  --query 'NetworkAcls[0].Entries' \
  --output table

# Remember: NACLs are stateless, you need rules for both directions
```

## Cost

Security groups and NACLs are **free** - no additional cost beyond the resources they protect.

## Integration with Other Modules

### Use with VPC Module

```hcl
# In main deployment file
module "vpc" {
  source = "./infrastructure/vpc"
  # ... vpc config
}

module "security_groups" {
  source = "./infrastructure/security-groups"

  vpc_id             = module.vpc.vpc_id
  vpc_cidr           = module.vpc.vpc_cidr
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
}
```

### Use with ECS Module

```hcl
resource "aws_ecs_service" "app" {
  network_configuration {
    subnets         = module.vpc.private_subnet_ids
    security_groups = [module.security_groups.app_security_group_id]
  }
}
```

### Use with RDS Module

```hcl
resource "aws_db_instance" "main" {
  vpc_security_group_ids = [module.security_groups.rds_security_group_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}
```

### Use with ALB Module

```hcl
resource "aws_lb" "main" {
  security_groups = [module.security_groups.alb_security_group_id]
  subnets         = module.vpc.public_subnet_ids
}
```

## Related Documentation

- [AWS_DEPLOYMENT.md](../../docs/AWS_DEPLOYMENT.md) - Full deployment guide
- [Phase 2.2 - Security Groups and NACLs](../../docs/AWS_DEPLOYMENT.md#22-security-groups-and-nacls-sec-1053)
- [AWS Security Groups Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html)
- [Network ACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html)

## Support

For questions or issues:
- Linear: [SEC-1053](https://linear.app/montecarlodata/issue/SEC-1053)
- Repository: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
