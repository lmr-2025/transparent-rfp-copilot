# RDS Security Configuration Guide

This document provides comprehensive security configuration, hardening, and operational procedures for the RDS PostgreSQL database infrastructure.

## Table of Contents

- [Overview](#overview)
- [Security Layers](#security-layers)
- [Initial Security Setup](#initial-security-setup)
- [Credential Management](#credential-management)
- [Network Security](#network-security)
- [Encryption](#encryption)
- [Access Control](#access-control)
- [Monitoring & Auditing](#monitoring--auditing)
- [Security Hardening Checklist](#security-hardening-checklist)
- [Incident Response](#incident-response)
- [Compliance](#compliance)
- [Security Testing](#security-testing)
- [Troubleshooting](#troubleshooting)

## Overview

The RDS PostgreSQL infrastructure implements defense-in-depth security with multiple layers of protection:

- **Network isolation**: Private subnets with no direct internet access
- **Encryption**: At rest (KMS) and in transit (SSL/TLS)
- **Access control**: Security groups, IAM policies, database users
- **Credential management**: AWS Secrets Manager with rotation
- **Monitoring**: CloudWatch Logs, alarms, Performance Insights
- **Auditing**: Database logs, CloudTrail, parameter group logging

## Security Layers

### Layer 1: Network Security
- VPC isolation with private subnets
- Security groups restricting access to application tier only
- No public accessibility
- Network ACLs (optional additional layer)

### Layer 2: Authentication & Authorization
- Strong password policy
- Secrets Manager for credential storage
- IAM database authentication (optional)
- Database role-based access control

### Layer 3: Encryption
- Encryption at rest with AWS KMS
- Automatic key rotation
- Encryption in transit with SSL/TLS
- Certificate validation

### Layer 4: Monitoring & Logging
- Enhanced monitoring
- Performance Insights
- CloudWatch Logs (connections, queries, errors)
- CloudWatch Alarms
- CloudTrail API logging

### Layer 5: Backup & Recovery
- Automated daily backups
- Point-in-time recovery
- Multi-AZ for high availability
- Final snapshots on deletion

## Initial Security Setup

### 1. Verify Security Configuration

After deploying the RDS infrastructure, verify all security features are enabled:

```bash
# Get RDS instance details
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].{
    Encrypted:StorageEncrypted,
    MultiAZ:MultiAZ,
    PubliclyAccessible:PubliclyAccessible,
    DeletionProtection:DeletionProtection,
    BackupRetention:BackupRetentionPeriod,
    EnhancedMonitoring:MonitoringInterval,
    PerformanceInsights:PerformanceInsightsEnabled
  }' \
  --output table
```

**Expected Output**:
```
---------------------------------
|  DescribeDBInstances          |
+-------------------------+------+
|  BackupRetention        |  7   |
|  DeletionProtection     | True |
|  Encrypted              | True |
|  EnhancedMonitoring     |  60  |
|  MultiAZ                | True |
|  PerformanceInsights    | True |
|  PubliclyAccessible     | False|
+-------------------------+------+
```

### 2. Verify SSL/TLS Enforcement

```bash
# Check parameter group for SSL enforcement
aws rds describe-db-parameters \
  --db-parameter-group-name transparent-rfp-db-params-production \
  --query "Parameters[?ParameterName=='rds.force_ssl'].{Name:ParameterName,Value:ParameterValue}" \
  --output table
```

**Expected Output**: `rds.force_ssl = 1`

### 3. Verify Network Configuration

```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids <rds-security-group-id> \
  --query 'SecurityGroups[0].IpPermissions[*].{
    Port:FromPort,
    Protocol:IpProtocol,
    Source:UserIdGroupPairs[0].GroupId
  }' \
  --output table
```

**Expected**: Only port 5432 from application security group

### 4. Verify Encryption

```bash
# Check KMS key details
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].{KMSKey:KmsKeyId,Encrypted:StorageEncrypted}' \
  --output table

# Verify KMS key rotation
aws kms get-key-rotation-status \
  --key-id <kms-key-id>
```

**Expected**: Key rotation enabled

## Credential Management

### Master Credentials

Master database credentials are stored in AWS Secrets Manager and should be used sparingly.

#### Retrieving Master Credentials

```bash
# Get master credentials
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-db-credentials-production \
  --query SecretString \
  --output text | jq -r '.'
```

**Output format**:
```json
{
  "username": "dbadmin",
  "password": "SECURE_GENERATED_PASSWORD",
  "engine": "postgres",
  "host": "transparent-rfp-db-production.xxxxx.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "rfp_copilot"
}
```

#### Credential Rotation

AWS Secrets Manager supports automatic credential rotation for RDS:

**Enable Automatic Rotation**:

```bash
# Enable rotation (30 days)
aws secretsmanager rotate-secret \
  --secret-id transparent-rfp-db-credentials-production \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRDSPostgreSQLRotation \
  --rotation-rules AutomaticallyAfterDays=30
```

**Manual Rotation Process**:

1. Create new master password:
```bash
# Generate secure password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update password in database
psql "postgresql://dbadmin:OLD_PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require" \
  -c "ALTER USER dbadmin WITH PASSWORD '$NEW_PASSWORD';"

# Update Secrets Manager
aws secretsmanager update-secret \
  --secret-id transparent-rfp-db-credentials-production \
  --secret-string "{\"username\":\"dbadmin\",\"password\":\"$NEW_PASSWORD\",\"engine\":\"postgres\",\"host\":\"<endpoint>\",\"port\":5432,\"dbname\":\"rfp_copilot\"}"
```

2. Verify new credentials work
3. Restart application to pick up new credentials

**Best Practices**:
- Rotate credentials every 30-90 days
- Use IAM database authentication for application access (eliminates password management)
- Never log or expose master credentials
- Use application-specific database users with limited privileges

### Application Database Users

**Create dedicated application user** (recommended over using master credentials):

```sql
-- Connect as master user
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require"

-- Create application user with limited privileges
CREATE USER app_user WITH PASSWORD 'STRONG_PASSWORD_HERE';

-- Grant necessary privileges only
GRANT CONNECT ON DATABASE rfp_copilot TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Verify permissions
\du app_user
```

**Store application user credentials in Secrets Manager**:

```bash
aws secretsmanager create-secret \
  --name transparent-rfp-app-db-credentials-production \
  --description "Application database user credentials" \
  --secret-string "{\"username\":\"app_user\",\"password\":\"STRONG_PASSWORD_HERE\",\"engine\":\"postgres\",\"host\":\"<endpoint>\",\"port\":5432,\"dbname\":\"rfp_copilot\"}"
```

**Update application to use app_user credentials instead of master credentials**.

### IAM Database Authentication

For enhanced security, enable IAM database authentication (eliminates password-based authentication):

**1. Enable IAM authentication on RDS instance**:

Already configured in Terraform via `iam_database_authentication_enabled` variable.

**2. Create database user for IAM authentication**:

```sql
-- Connect as master user
CREATE USER iam_app_user;
GRANT rds_iam TO iam_app_user;
GRANT CONNECT ON DATABASE rfp_copilot TO iam_app_user;
GRANT USAGE ON SCHEMA public TO iam_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iam_app_user;
```

**3. Update IAM policy** to allow application role to connect:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": [
        "arn:aws:rds-db:us-east-1:ACCOUNT_ID:dbuser:DB_RESOURCE_ID/iam_app_user"
      ]
    }
  ]
}
```

**4. Connect using IAM authentication**:

```javascript
// Node.js example
const AWS = require('aws-sdk');
const { Client } = require('pg');

const signer = new AWS.RDS.Signer({
  region: 'us-east-1',
  hostname: 'transparent-rfp-db-production.xxxxx.us-east-1.rds.amazonaws.com',
  port: 5432,
  username: 'iam_app_user'
});

const token = signer.getAuthToken({});

const client = new Client({
  host: 'transparent-rfp-db-production.xxxxx.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'iam_app_user',
  password: token,
  database: 'rfp_copilot',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./rds-ca-cert.pem')
  }
});
```

## Network Security

### Security Group Configuration

The RDS security group should only allow traffic from the application security group:

**Verify security group rules**:

```bash
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*rds-sg*" \
  --query 'SecurityGroups[*].{
    GroupId:GroupId,
    GroupName:GroupName,
    IngressRules:IpPermissions
  }'
```

**Expected configuration**:
- **Ingress**: Port 5432 from application security group only
- **Egress**: None (RDS instances don't need outbound access)

**Hardening recommendations**:
- Never allow 0.0.0.0/0 access
- Use security group references, not CIDR blocks
- Regularly audit security group rules
- Use VPC Flow Logs to monitor traffic

### Subnet Configuration

**Verify RDS is in private subnets**:

```bash
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].{
    PubliclyAccessible:PubliclyAccessible,
    Subnets:DBSubnetGroup.Subnets[*].SubnetIdentifier
  }'
```

**Expected**:
- `PubliclyAccessible: false`
- Subnets should be private subnets with no IGW route

### Network Access Control Lists (NACLs)

If using NACLs for defense-in-depth:

**Private subnet NACL rules**:

Inbound:
- Rule 100: Allow TCP 5432 from VPC CIDR (10.0.0.0/16)
- Rule 200: Allow TCP 1024-65535 from VPC CIDR (ephemeral ports)
- Rule *: Deny all

Outbound:
- Rule 100: Allow TCP 1024-65535 to VPC CIDR (ephemeral ports)
- Rule *: Deny all

## Encryption

### Encryption at Rest

**Verify encryption**:

```bash
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].{
    Encrypted:StorageEncrypted,
    KMSKey:KmsKeyId
  }'
```

**KMS key management**:

```bash
# View key details
aws kms describe-key --key-id <kms-key-id>

# Check key rotation status
aws kms get-key-rotation-status --key-id <kms-key-id>

# View key policy
aws kms get-key-policy \
  --key-id <kms-key-id> \
  --policy-name default \
  --output text | jq '.'
```

**Key rotation**: Automatic annual rotation is enabled by default.

**Important**: Once encryption is enabled, it cannot be disabled. To change encryption settings:
1. Create snapshot
2. Copy snapshot with new encryption settings
3. Restore from encrypted snapshot

### Encryption in Transit (SSL/TLS)

**Verify SSL enforcement**:

```bash
# Check parameter group
aws rds describe-db-parameters \
  --db-parameter-group-name transparent-rfp-db-params-production \
  --query "Parameters[?ParameterName=='rds.force_ssl'].{Name:ParameterName,Value:ParameterValue}"
```

**Download RDS CA certificate**:

```bash
# Download RDS root CA bundle
curl -o rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# For region-specific certificate
curl -o rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem
```

**Test SSL connection**:

```bash
# Connect with SSL required
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require"

# Connect with SSL verification
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=verify-full&sslrootcert=rds-ca-bundle.pem"

# Verify SSL in session
psql -c "SELECT ssl_is_used();"
```

**Expected**: `ssl_is_used() = true`

**Application configuration**:

```javascript
// Node.js with pg
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./rds-ca-bundle.pem').toString()
  }
});
```

## Access Control

### Database Users & Roles

**Principle of least privilege**: Create specific users for different purposes.

**Recommended user structure**:

```sql
-- 1. Master admin user (dbadmin) - use sparingly, only for admin tasks
-- Already created by RDS

-- 2. Application user - daily operations
CREATE USER app_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT CONNECT ON DATABASE rfp_copilot TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. Read-only user - reporting, analytics
CREATE USER readonly_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT CONNECT ON DATABASE rfp_copilot TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- 4. Migration user - schema changes (used by CI/CD)
CREATE USER migration_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT CONNECT ON DATABASE rfp_copilot TO migration_user;
GRANT USAGE, CREATE ON SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_user;

-- 5. Monitor user - performance monitoring
CREATE USER monitor_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT CONNECT ON DATABASE rfp_copilot TO monitor_user;
GRANT pg_monitor TO monitor_user;
```

### Password Policy

**Configure strong password requirements**:

```sql
-- Set password encryption
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Reload configuration
SELECT pg_reload_conf();
```

**Best practices**:
- Minimum 16 characters
- Include uppercase, lowercase, numbers, special characters
- Generate passwords using cryptographically secure methods
- Store passwords only in Secrets Manager
- Rotate passwords every 30-90 days

### Connection Limits

**Set per-user connection limits** to prevent resource exhaustion:

```sql
-- Limit application user connections
ALTER USER app_user CONNECTION LIMIT 50;

-- Limit read-only user connections
ALTER USER readonly_user CONNECTION LIMIT 10;

-- Check current connections
SELECT usename, count(*)
FROM pg_stat_activity
GROUP BY usename;
```

## Monitoring & Auditing

### CloudWatch Logs

**Enable PostgreSQL logs**:

Already configured in parameter group:
- `log_connections = 1` - Log all connection attempts
- `log_disconnections = 1` - Log all disconnections
- `log_statement = 'ddl'` - Log DDL statements
- `log_min_duration_statement = 1000` - Log slow queries (>1s)

**View logs in CloudWatch**:

```bash
# List log streams
aws logs describe-log-streams \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --max-items 10

# Get recent logs
aws logs tail /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --follow \
  --format short
```

**Log analysis queries**:

```bash
# Search for failed connections
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "FATAL" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Search for suspicious activity
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "DROP TABLE" \
  --start-time $(date -u -d '24 hours ago' +%s)000
```

### Enhanced Monitoring

**View enhanced monitoring metrics**:

```bash
# Get CPU metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=transparent-rfp-db-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

### Performance Insights

**Access Performance Insights**:
- AWS Console → RDS → Performance Insights
- View top SQL queries
- Analyze wait events
- Identify performance bottlenecks

### CloudWatch Alarms

**Verify security-related alarms**:

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix transparent-rfp-db-production \
  --query 'MetricAlarms[*].{Name:AlarmName,Metric:MetricName,Threshold:Threshold,State:StateValue}'
```

**Recommended security alarms** (in addition to performance alarms):

```bash
# High connection count (possible DoS)
aws cloudwatch put-metric-alarm \
  --alarm-name transparent-rfp-db-production-high-connections \
  --alarm-description "Alert when connection count is high" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=transparent-rfp-db-production

# Failed connection attempts (possible brute force)
# Note: Requires custom metric from log analysis
```

### CloudTrail Auditing

**View RDS API calls**:

```bash
# View recent RDS modifications
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50 \
  --query 'Events[*].{Time:EventTime,User:Username,Action:EventName,Resource:Resources[0].ResourceName}'
```

**Monitor for suspicious activities**:
- Unauthorized ModifyDBInstance calls
- Unexpected DeleteDBInstance attempts
- Security group modifications
- Parameter group changes
- Snapshot operations

## Security Hardening Checklist

### Initial Deployment

- [ ] Verify RDS instance is in private subnets
- [ ] Confirm PubliclyAccessible is false
- [ ] Verify encryption at rest is enabled with KMS
- [ ] Confirm SSL/TLS enforcement (rds.force_ssl=1)
- [ ] Verify Multi-AZ is enabled
- [ ] Confirm deletion protection is enabled
- [ ] Verify automated backups are configured (7+ days retention)
- [ ] Check security group allows only application tier access
- [ ] Verify master credentials are in Secrets Manager
- [ ] Confirm enhanced monitoring is enabled (60s granularity)
- [ ] Verify Performance Insights is enabled
- [ ] Check CloudWatch alarms are configured
- [ ] Verify KMS key rotation is enabled
- [ ] Confirm parameter group has security settings
- [ ] Review IAM policies for RDS access

### Post-Deployment

- [ ] Create application-specific database users
- [ ] Set connection limits per user
- [ ] Configure password policy
- [ ] Test SSL connections with certificate validation
- [ ] Verify CloudWatch Logs are being generated
- [ ] Test CloudWatch alarms trigger correctly
- [ ] Document all database users and their purposes
- [ ] Set up credential rotation schedule
- [ ] Configure backup retention policy
- [ ] Enable IAM database authentication (optional)
- [ ] Review and audit security group rules
- [ ] Set up CloudTrail monitoring for RDS API calls
- [ ] Create runbook for security incidents
- [ ] Schedule regular security audits

### Regular Maintenance (Monthly)

- [ ] Review database user accounts (remove unused)
- [ ] Audit security group rules
- [ ] Review CloudWatch Logs for suspicious activity
- [ ] Check CloudTrail for unauthorized API calls
- [ ] Verify all alarms are functioning
- [ ] Review backup and snapshot retention
- [ ] Update SSL certificates if needed
- [ ] Review Performance Insights for anomalies
- [ ] Check for RDS security patches
- [ ] Rotate database credentials
- [ ] Review IAM policies and permissions
- [ ] Audit database connections and queries
- [ ] Test disaster recovery procedures
- [ ] Update security documentation

### Quarterly Security Audit

- [ ] Full security assessment of RDS configuration
- [ ] Penetration testing (if applicable)
- [ ] Review all access controls and permissions
- [ ] Audit all database users and roles
- [ ] Review encryption configuration
- [ ] Assess network security configuration
- [ ] Review monitoring and alerting effectiveness
- [ ] Test incident response procedures
- [ ] Review compliance requirements
- [ ] Update security documentation
- [ ] Security training for team members
- [ ] Review and update security policies

## Incident Response

### Security Event Categories

#### 1. Unauthorized Access Attempts

**Indicators**:
- Multiple failed login attempts in logs
- Connection attempts from unexpected IPs
- Unusual connection patterns

**Response**:
```bash
# 1. Identify source
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "authentication failed" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 2. Review security group for unauthorized changes
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# 3. Rotate credentials immediately
aws secretsmanager rotate-secret \
  --secret-id transparent-rfp-db-credentials-production

# 4. Review CloudTrail for API modifications
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance
```

#### 2. Suspicious Database Activity

**Indicators**:
- Unexpected DROP or DELETE operations
- Unusual data access patterns
- High volume of queries from single source

**Response**:
```bash
# 1. Identify active sessions
psql -c "SELECT pid, usename, application_name, client_addr, state, query
         FROM pg_stat_activity
         WHERE state = 'active';"

# 2. Terminate suspicious connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE usename = 'suspicious_user';"

# 3. Review query history
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "DROP TABLE"

# 4. Create immediate snapshot
aws rds create-db-snapshot \
  --db-instance-identifier transparent-rfp-db-production \
  --db-snapshot-identifier emergency-snapshot-$(date +%Y%m%d-%H%M%S)
```

#### 3. Configuration Changes

**Indicators**:
- Unexpected RDS instance modifications
- Security group rule changes
- Parameter group modifications

**Response**:
```bash
# 1. Review recent changes
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=ModifyDBInstance

# 2. Compare current vs expected configuration
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production

# 3. Revert unauthorized changes if needed
terraform plan  # Review changes
terraform apply # Restore correct configuration

# 4. Investigate who made changes and why
```

#### 4. Data Breach or Exfiltration

**Indicators**:
- Large unexpected data exports
- Unusual SELECT queries with large result sets
- Unexpected backup or snapshot operations

**Response**:
1. **Immediate containment**: Disable compromised users, rotate credentials
2. **Assessment**: Determine what data was accessed
3. **Notification**: Alert security team, legal, compliance
4. **Investigation**: Review logs, CloudTrail, database queries
5. **Recovery**: Restore from clean backup if needed
6. **Prevention**: Implement additional controls

### Incident Response Contacts

- **Security Team**: security@company.com
- **On-Call Engineer**: PagerDuty/OpsGenie
- **AWS Support**: AWS Premium Support
- **Compliance Officer**: compliance@company.com

### Communication Plan

1. **Detection** (0-15 min): Alert on-call engineer
2. **Assessment** (15-30 min): Determine severity, impact
3. **Escalation** (30-60 min): Notify management if needed
4. **Resolution** (varies): Contain, remediate, recover
5. **Post-Incident** (24-48 hours): Root cause analysis, documentation

## Compliance

### Common Compliance Frameworks

#### SOC 2
- [ ] Encryption at rest and in transit
- [ ] Access controls and authentication
- [ ] Audit logging and monitoring
- [ ] Backup and disaster recovery
- [ ] Incident response procedures

#### HIPAA
- [ ] Encryption (required)
- [ ] Access controls
- [ ] Audit logs (retain for 6 years)
- [ ] Backup and recovery
- [ ] Business Associate Agreements

#### PCI DSS
- [ ] Encryption at rest and in transit
- [ ] Strong access controls
- [ ] Regular security testing
- [ ] Audit logging
- [ ] Network segmentation

#### GDPR
- [ ] Encryption (required for personal data)
- [ ] Access controls
- [ ] Data retention policies
- [ ] Right to erasure (ability to delete data)
- [ ] Breach notification procedures (72 hours)

### Compliance Documentation

**Maintain evidence of**:
- Security configurations
- Access control policies
- Encryption settings
- Backup procedures
- Audit logs
- Security assessments
- Incident response procedures

### Data Retention

**Configure appropriate retention periods**:

```sql
-- Example: Delete old audit logs
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 years';

-- Archive old data
CREATE TABLE archived_data AS SELECT * FROM data WHERE created_at < NOW() - INTERVAL '3 years';
DELETE FROM data WHERE created_at < NOW() - INTERVAL '3 years';
```

## Security Testing

### Penetration Testing

**Before conducting penetration testing**:
1. Get written approval from AWS (required)
2. Notify security team
3. Use controlled test environment if possible
4. Document scope and methods

**Submit request**: https://aws.amazon.com/security/penetration-testing/

### Vulnerability Assessment

**Regular assessment checklist**:

```bash
# 1. Check for outdated PostgreSQL version
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].EngineVersion'

# 2. Scan for weak database passwords (if applicable)
# Note: Use IAM authentication instead of passwords

# 3. Test SSL/TLS configuration
openssl s_client -connect <endpoint>:5432 -starttls postgres

# 4. Verify security group configuration
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# 5. Check for public accessibility
aws rds describe-db-instances \
  --query 'DBInstances[*].{ID:DBInstanceIdentifier,Public:PubliclyAccessible}'

# 6. Review IAM policies for overly permissive access
aws iam get-policy-version \
  --policy-arn <policy-arn> \
  --version-id v1
```

### Security Scanning Tools

**Recommended tools**:
- **AWS Config**: Compliance checks
- **AWS Security Hub**: Centralized security findings
- **AWS Inspector**: Vulnerability scanning
- **Prisma Cloud**: Cloud security posture management
- **ScoutSuite**: Multi-cloud security auditing
- **Prowler**: AWS security best practices assessment

**Run Prowler check**:
```bash
# Install Prowler
pip install prowler

# Run RDS-specific checks
prowler aws -s rds

# Generate report
prowler aws -s rds -M csv json-asff html
```

### Load Testing & DoS Simulation

**Test connection limits and rate limiting**:

```bash
# Generate connection load (use carefully!)
for i in {1..100}; do
  psql "postgresql://app_user:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require" \
    -c "SELECT 1" &
done

# Monitor connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor alarms
aws cloudwatch describe-alarm-history \
  --alarm-name transparent-rfp-db-production-high-connections
```

## Troubleshooting

### Cannot Connect to Database

**Check 1: Network connectivity**
```bash
# Test network path
telnet <endpoint> 5432

# Check security group
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# Check NACLs
aws ec2 describe-network-acls --filters "Name=association.subnet-id,Values=<subnet-id>"
```

**Check 2: Authentication**
```bash
# Verify credentials in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id transparent-rfp-db-credentials-production

# Test connection
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require"
```

**Check 3: SSL/TLS issues**
```bash
# Download latest CA bundle
curl -o rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Test with SSL
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/rfp_copilot?sslmode=require"
```

### High CPU or Memory Usage

```bash
# Check Performance Insights
# AWS Console → RDS → Performance Insights

# Identify slow queries
psql -c "SELECT pid, query, state, wait_event_type, wait_event
         FROM pg_stat_activity
         WHERE state != 'idle'
         ORDER BY query_start;"

# Check for locks
psql -c "SELECT blocked_locks.pid AS blocked_pid,
         blocked_activity.usename AS blocked_user,
         blocking_locks.pid AS blocking_pid,
         blocking_activity.usename AS blocking_user,
         blocked_activity.query AS blocked_statement
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;"
```

### Storage Running Out

```bash
# Check current storage
aws rds describe-db-instances \
  --db-instance-identifier transparent-rfp-db-production \
  --query 'DBInstances[0].{Allocated:AllocatedStorage,Max:MaxAllocatedStorage}'

# Identify large tables
psql -c "SELECT schemaname, tablename,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
         FROM pg_tables
         ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
         LIMIT 10;"

# Check for bloat
psql -c "SELECT schemaname, tablename,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as bloat
         FROM pg_tables
         ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Failed Login Attempts

```bash
# Search logs for failed authentications
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "authentication failed" \
  --start-time $(date -u -d '24 hours ago' +%s)000

# Check for brute force patterns
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transparent-rfp-db-production/postgresql \
  --filter-pattern "password authentication failed" \
  --start-time $(date -u -d '1 hour ago' +%s)000 | \
  jq -r '.events[].message' | \
  grep -oP 'user=\w+' | \
  sort | uniq -c | sort -nr
```

## Additional Resources

### AWS Documentation
- [RDS Security Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.Security.html)
- [RDS PostgreSQL Security](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.html)
- [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [RDS Encryption](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html)

### PostgreSQL Security
- [PostgreSQL Security Documentation](https://www.postgresql.org/docs/current/security.html)
- [PostgreSQL SSL Support](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [PostgreSQL Authentication Methods](https://www.postgresql.org/docs/current/auth-methods.html)

### Security Standards
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
- [NIST Database Security Guidelines](https://csrc.nist.gov/publications)

### Internal Documentation
- [infrastructure/rds/README.md](../infrastructure/rds/README.md) - RDS infrastructure documentation
- [docs/AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) - Overall AWS deployment guide
- [docs/runbooks/database-migration.md](./runbooks/database-migration.md) - Database migration procedures

---

**Document Version**: 1.0
**Last Updated**: 2025-12-18
**Maintained By**: Security Team
**Review Schedule**: Quarterly
