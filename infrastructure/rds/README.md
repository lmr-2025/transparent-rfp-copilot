# RDS PostgreSQL

This directory contains Terraform configurations for the RDS PostgreSQL database for the Transparent Trust application.

**Linear Issue**: [SEC-1049 - RDS PostgreSQL](https://linear.app/montecarlodata/issue/SEC-1049)

## Overview

This module creates a production-ready RDS PostgreSQL 16 database with:
- Multi-AZ deployment for high availability
- Encryption at rest with KMS
- Automated backups with configurable retention
- Enhanced monitoring
- Performance Insights
- CloudWatch alarms
- SSL/TLS enforcement
- IAM database authentication
- Credentials stored in Secrets Manager

## Architecture

```
┌─────────────────────────────────────────────┐
│          Private Subnet (us-east-1a)        │
│  ┌────────────────────────────────────────┐ │
│  │  RDS PostgreSQL Primary                │ │
│  │  • Instance: db.t3.micro              │ │
│  │  • Storage: 20GB (auto-scale to 100GB)│ │
│  │  • Encrypted with KMS                  │ │
│  │  • Enhanced Monitoring                 │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
              │
              │ Synchronous Replication
              ▼
┌─────────────────────────────────────────────┐
│          Private Subnet (us-east-1b)        │
│  ┌────────────────────────────────────────┐ │
│  │  RDS PostgreSQL Standby (Multi-AZ)    │ │
│  │  • Automatic failover                  │ │
│  │  • Same configuration as primary       │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Features

### High Availability
- **Multi-AZ deployment**: Synchronous replication to standby in different AZ
- **Automatic failover**: <2 minute RTO, RPO = 0 (no data loss)
- **Cross-AZ backups**: Stored redundantly across multiple AZs

### Security
- **Encryption at rest**: KMS encryption for data, logs, and backups
- **Encryption in transit**: SSL/TLS enforcement
- **Network isolation**: Deployed in private subnets
- **Security groups**: Only application can connect
- **IAM authentication**: Optional IAM database authentication
- **Secrets Manager**: Credentials stored securely

### Backup & Recovery
- **Automated backups**: Daily snapshots with 7-day retention (configurable 0-35 days)
- **Point-in-time recovery**: Restore to any point within backup retention period
- **Manual snapshots**: Create additional snapshots anytime
- **Final snapshot**: Automatic final snapshot on deletion (optional)

### Monitoring
- **Enhanced Monitoring**: OS-level metrics every 60 seconds
- **Performance Insights**: Query performance analysis
- **CloudWatch Logs**: PostgreSQL logs exported to CloudWatch
- **CloudWatch Alarms**:
  - High CPU utilization (>80%)
  - Low freeable memory (<256MB)
  - Low free storage (<2GB)
  - High database connections (>80)

### Performance
- **Storage autoscaling**: Automatically grows from 20GB to 100GB
- **gp3 storage**: Modern SSD storage with consistent performance
- **Performance Insights**: Identify slow queries and bottlenecks

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_name` | Project name | `transparent-trust` | No |
| `environment` | Environment | `production` | No |
| `vpc_id` | VPC ID | - | Yes |
| `private_subnet_ids` | Private subnet IDs | - | Yes |
| `rds_security_group_id` | Security group ID | - | Yes |
| `rds_monitoring_role_arn` | IAM role for enhanced monitoring | - | Yes |
| `database_name` | Database name | `grcminion` | No |
| `master_username` | Master username | `dbadmin` | No |
| `postgres_version` | PostgreSQL version | `16.1` | No |
| `instance_class` | Instance type | `db.t3.micro` | No |
| `allocated_storage` | Initial storage (GB) | `20` | No |
| `max_allocated_storage` | Max storage for autoscaling (GB) | `100` | No |
| `storage_type` | Storage type | `gp3` | No |
| `multi_az` | Enable Multi-AZ | `true` | No |
| `backup_retention_period` | Backup retention (days) | `7` | No |
| `monitoring_interval` | Enhanced monitoring interval (s) | `60` | No |
| `force_ssl` | Force SSL connections | `true` | No |
| `deletion_protection` | Enable deletion protection | `true` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `db_instance_endpoint` | Connection endpoint (host:port) |
| `db_instance_address` | Hostname |
| `db_instance_port` | Port (5432) |
| `database_url` | PostgreSQL connection URL (without password) |
| `db_credentials_secret_arn` | Secrets Manager ARN for credentials |
| `db_credentials_secret_name` | Secrets Manager secret name |

## Deployment

### Prerequisites

```bash
# VPC, security groups, and IAM roles must be deployed first
cd ../vpc && terraform apply
cd ../security-groups && terraform apply
cd ../iam && terraform apply
```

### Deploy RDS

```bash
# Navigate to RDS directory
cd infrastructure/rds

# Initialize Terraform
terraform init

# Get required info from other modules
VPC_ID=$(cd ../vpc && terraform output -raw vpc_id)
PRIVATE_SUBNETS=$(cd ../vpc && terraform output -json private_subnet_ids)
RDS_SG=$(cd ../security-groups && terraform output -raw rds_security_group_id)
MONITORING_ROLE=$(cd ../iam && terraform output -raw rds_enhanced_monitoring_role_arn)

# Review planned changes
terraform plan \
  -var="vpc_id=$VPC_ID" \
  -var="private_subnet_ids=$PRIVATE_SUBNETS" \
  -var="rds_security_group_id=$RDS_SG" \
  -var="rds_monitoring_role_arn=$MONITORING_ROLE" \
  -var="environment=production"

# Apply configuration (takes 15-20 minutes)
terraform apply \
  -var="vpc_id=$VPC_ID" \
  -var="private_subnet_ids=$PRIVATE_SUBNETS" \
  -var="rds_security_group_id=$RDS_SG" \
  -var="rds_monitoring_role_arn=$MONITORING_ROLE" \
  -var="environment=production"
```

### Production Configuration

```bash
terraform apply \
  -var="environment=production" \
  -var="instance_class=db.t3.small" \
  -var="allocated_storage=50" \
  -var="max_allocated_storage=200" \
  -var="multi_az=true" \
  -var="backup_retention_period=14" \
  -var="deletion_protection=true"
```

### Development Configuration (Cost-Optimized)

```bash
terraform apply \
  -var="environment=development" \
  -var="instance_class=db.t3.micro" \
  -var="allocated_storage=20" \
  -var="multi_az=false" \
  -var="backup_retention_period=1" \
  -var="deletion_protection=false" \
  -var="skip_final_snapshot=true" \
  -var="performance_insights_enabled=false"
```

## Connecting to the Database

### Get Credentials from Secrets Manager

```bash
# Get secret name
SECRET_NAME=$(terraform output -raw db_credentials_secret_name)

# Retrieve credentials
aws secretsmanager get-secret-value \
  --secret-id $SECRET_NAME \
  --query SecretString \
  --output text | jq -r .

# Extract individual values
DB_HOST=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text | jq -r .host)
DB_USER=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text | jq -r .username)
DB_PASS=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text | jq -r .password)
DB_NAME=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text | jq -r .dbname)
```

### Connect with psql

```bash
# From application container or bastion host
psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME?sslmode=require"

# Or using environment variable
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME?sslmode=require"
psql $DATABASE_URL
```

### Connection String for Application

```env
# .env or environment variables
DATABASE_URL="postgresql://dbadmin:[PASSWORD]@transparent-trust-db-production.xxxx.us-east-1.rds.amazonaws.com:5432/grcminion?sslmode=require"
```

**Security Note**: Never hardcode credentials. Use Secrets Manager:

```typescript
// Fetch from Secrets Manager at runtime
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({
  SecretId: 'transparent-trust/database/production'
});
const credentials = JSON.parse(secret.SecretString);
const DATABASE_URL = `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}?sslmode=require`;
```

## Running Migrations

### Using Prisma

```bash
# Set DATABASE_URL from Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id transparent-trust/database/production \
  --query SecretString \
  --output text | jq -r '"postgresql://\(.username):\(.password)@\(.host):\(.port)/\(.dbname)?sslmode=require"')

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db pull
```

## Cost Estimates

Rough monthly costs for production (us-east-1):

| Configuration | Instance | Storage | Multi-AZ | Est. Monthly Cost |
|---------------|----------|---------|----------|-------------------|
| Development | db.t3.micro | 20GB gp3 | No | ~$15 |
| Production (Small) | db.t3.small | 50GB gp3 | Yes | ~$60 |
| Production (Medium) | db.t3.medium | 100GB gp3 | Yes | ~$120 |

**Additional costs**:
- Backup storage (beyond allocated): ~$0.095/GB/month
- Enhanced monitoring: Included
- Performance Insights (7 days): Free
- Performance Insights (731 days): ~$7/month
- Data transfer: Varies

## Verification

### Check RDS Status

```bash
# Get instance details
aws rds describe-db-instances \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBInstances[0].[DBInstanceStatus,MultiAZ,StorageEncrypted,BackupRetentionPeriod]' \
  --output table

# Check endpoint
aws rds describe-db-instances \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port]' \
  --output table
```

### Test Connection

```bash
# From within VPC (bastion or ECS task)
DB_ENDPOINT=$(terraform output -raw db_instance_endpoint | cut -d: -f1)
pg_isready -h $DB_ENDPOINT -p 5432

# Test SSL connection
psql "$DATABASE_URL" -c "SHOW ssl;"
# Should return: on
```

### View CloudWatch Metrics

```bash
# CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=transparent-trust-db-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Database connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=transparent-trust-db-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## Troubleshooting

### Can't Connect from Application

**Symptoms**: Connection timeout or refused

**Checks**:
```bash
# 1. Verify security group allows app → RDS
aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$(terraform output -raw rds_security_group_id)" \
  --query 'SecurityGroupRules[?!IsEgress]'

# 2. Verify app is using correct security group
# Check ECS task security group

# 3. Verify RDS is in private subnet
aws rds describe-db-instances \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBInstances[0].DBSubnetGroup.Subnets[*].[SubnetIdentifier,SubnetAvailabilityZone.Name]'

# 4. Test from same VPC
# SSH to bastion or exec into ECS container and test connection
```

### SSL Connection Fails

**Symptoms**: SSL error or connection refused with sslmode=require

**Solution**:
```bash
# Check if SSL is enforced
aws rds describe-db-parameters \
  --db-parameter-group-name transparent-trust-postgres16-production \
  --query "Parameters[?ParameterName=='rds.force_ssl']"

# Download RDS CA certificate
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Connect with certificate verification
psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME?sslmode=verify-full&sslrootcert=global-bundle.pem"
```

### Storage Full

**Symptoms**: Can't write to database, errors about disk space

**Solution**:
```bash
# Check current storage usage
aws rds describe-db-instances \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBInstances[0].[AllocatedStorage,MaxAllocatedStorage]'

# Storage autoscaling should handle this automatically
# If max_allocated_storage reached, increase it:
terraform apply -var="max_allocated_storage=200"

# Or manually increase allocated storage:
aws rds modify-db-instance \
  --db-instance-identifier transparent-trust-db-production \
  --allocated-storage 50 \
  --apply-immediately
```

### High CPU Usage

**Symptoms**: Slow queries, timeouts

**Investigation**:
```bash
# Check CPU metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=transparent-trust-db-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Use Performance Insights to identify slow queries
# Open AWS Console → RDS → transparent-trust-db-production → Performance Insights

# Connect to database and check active queries
psql $DATABASE_URL -c "SELECT pid, query, state, wait_event_type, wait_event FROM pg_stat_activity WHERE state != 'idle';"
```

### Multi-AZ Failover

**Symptoms**: Brief connection interruption

**What happens**:
1. RDS detects primary failure
2. Promotes standby to primary (<2 minutes)
3. Updates DNS record to point to new primary
4. Applications reconnect automatically

**Verify failover**:
```bash
# Check which AZ is primary
aws rds describe-db-instances \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBInstances[0].AvailabilityZone'

# Initiate manual failover (testing only!)
aws rds reboot-db-instance \
  --db-instance-identifier transparent-trust-db-production \
  --force-failover
```

## Backup & Recovery

### Manual Snapshot

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-snapshot-identifier transparent-trust-manual-$(date +%Y%m%d-%H%M%S) \
  --db-instance-identifier transparent-trust-db-production

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier transparent-trust-db-production \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table
```

### Restore from Snapshot

```bash
# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier transparent-trust-db-restored \
  --db-snapshot-identifier transparent-trust-manual-20250101-120000 \
  --db-instance-class db.t3.small \
  --vpc-security-group-ids sg-xxxx \
  --db-subnet-group-name transparent-trust-db-subnet-production

# Or use Terraform with snapshot identifier
```

### Point-in-Time Recovery

```bash
# Restore to specific time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier transparent-trust-db-production \
  --target-db-instance-identifier transparent-trust-db-pitr \
  --restore-time 2025-01-01T12:00:00Z \
  --db-instance-class db.t3.small \
  --vpc-security-group-ids sg-xxxx \
  --db-subnet-group-name transparent-trust-db-subnet-production
```

## Maintenance

### Upgrade PostgreSQL Version

```bash
# Check available versions
aws rds describe-db-engine-versions \
  --engine postgres \
  --engine-version 16.1 \
  --query 'DBEngineVersions[0].ValidUpgradeTarget[*].EngineVersion'

# Update variable and apply
terraform apply -var="postgres_version=16.2"
```

### Scale Instance

```bash
# Update instance class
terraform apply -var="instance_class=db.t3.small"

# Apply immediately or during maintenance window
# (Terraform uses maintenance window by default)
```

## Security Best Practices

1. **Network Isolation**: RDS in private subnets only
2. **Encryption**: Always enable encryption at rest and in transit
3. **Secrets Management**: Never hardcode credentials
4. **Multi-AZ**: Always enable for production
5. **Backups**: Keep 7+ days retention for production
6. **Monitoring**: Enable enhanced monitoring and Performance Insights
7. **SSL/TLS**: Force SSL connections
8. **IAM Auth**: Consider IAM database authentication for applications
9. **Deletion Protection**: Enable for production databases
10. **Parameter Groups**: Review and customize security parameters

## Related Documentation

- [AWS_DEPLOYMENT.md](../../docs/AWS_DEPLOYMENT.md) - Full deployment guide
- [Phase 3.1 - RDS PostgreSQL](../../docs/AWS_DEPLOYMENT.md#31-rds-postgresql-sec-1049)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [PostgreSQL on RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)

## Support

For questions or issues:
- Linear: [SEC-1049](https://linear.app/montecarlodata/issue/SEC-1049)
- Repository: [transparent-trust](https://github.com/monte-carlo-data/transparent-trust)
