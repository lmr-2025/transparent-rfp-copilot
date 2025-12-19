# Redis Infrastructure for Transparent Trust

Redis caching infrastructure for the Transparent Trust application, supporting both AWS ElastiCache (managed Redis in AWS) and Upstash (serverless Redis).

**Reference**: [SEC-1057 - Redis caching layer](https://linear.app/montecarlodata/issue/SEC-1057)

## Overview

This module provides Redis infrastructure for caching and rate limiting. Two options are supported:

1. **AWS ElastiCache Redis**: Managed Redis cluster in your VPC
2. **Upstash Redis**: Serverless Redis with no infrastructure management (already supported by the application)

## Architecture

### Option A: ElastiCache Redis

```
┌─────────────────────────────────────────────────────────────┐
│                     VPC                                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Application (ECS/Fargate)                           │  │
│  │  Security Group: app-sg                              │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 │ Port 6379 (TLS)                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Redis Security Group                                 │  │
│  │  - Allow 6379 from app-sg                            │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ElastiCache Replication Group                       │  │
│  │                                                       │  │
│  │  ┌────────────┐      ┌────────────┐                 │  │
│  │  │  Primary   │─────▶│  Replica   │                 │  │
│  │  │  Node      │      │  Node      │                 │  │
│  │  │ AZ-1       │      │  AZ-2      │                 │  │
│  │  └────────────┘      └────────────┘                 │  │
│  │                                                       │  │
│  │  - Encryption at rest (KMS)                          │  │
│  │  - Encryption in transit (TLS)                       │  │
│  │  - Auth token authentication                         │  │
│  │  - Automatic failover                                │  │
│  │  - Daily backups                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

                            │
                            ▼
                 ┌─────────────────────┐
                 │  Secrets Manager    │
                 │  - Auth token       │
                 └─────────────────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  CloudWatch         │
                 │  - Metrics          │
                 │  - Alarms           │
                 └─────────────────────┘
```

### Option B: Upstash Redis

```
┌─────────────────────────────────────────────────────────────┐
│                Application (Amplify/ECS)                     │
│                                                              │
│  Environment Variables:                                      │
│  - UPSTASH_REDIS_REST_URL   (from Secrets Manager)         │
│  - UPSTASH_REDIS_REST_TOKEN (from Secrets Manager)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS REST API
                       ▼
            ┌─────────────────────┐
            │   Upstash Redis     │
            │   (Serverless)      │
            │                     │
            │  - No VPC needed    │
            │  - Global CDN       │
            │  - Auto-scaling     │
            │  - Built-in TLS     │
            └─────────────────────┘
```

## Features

### ElastiCache Redis

- **Multi-AZ High Availability**: Automatic failover across availability zones
- **Encryption**: At rest (KMS) and in transit (TLS)
- **Authentication**: Redis auth token stored in Secrets Manager
- **Automatic Backups**: Daily snapshots with configurable retention
- **Monitoring**: CloudWatch metrics and alarms
- **Scaling**: Vertical (change node type) and horizontal (add replicas)
- **Maintenance**: Automatic minor version upgrades with maintenance window

### Upstash Redis

- **Serverless**: No infrastructure to manage
- **Global**: Multi-region with low latency
- **Auto-Scaling**: Scales automatically with usage
- **REST API**: HTTP-based access (no VPC connectivity needed)
- **Free Tier**: 10,000 commands/day free
- **Already Integrated**: Application already supports Upstash

## Comparison: ElastiCache vs. Upstash

| Feature | ElastiCache | Upstash |
|---------|-------------|---------|
| **Complexity** | Medium - VPC setup required | Low - No infrastructure |
| **Setup Time** | 15-30 minutes | 5 minutes |
| **Cost (low traffic)** | ~$23/month (2 nodes) | Free (up to 10K cmd/day) |
| **Cost (high traffic)** | ~$23-100/month | Pay as you go |
| **VPC Integration** | ✅ Yes (private access) | ❌ No (public HTTPS) |
| **Latency** | <1ms (same VPC) | 50-200ms (REST API) |
| **Scaling** | Manual (change node type) | Automatic |
| **Maintenance** | Managed (maintenance windows) | Fully managed |
| **Best For** | Production apps in VPC | Serverless apps, MVPs |

**Recommendation**:
- Use **ElastiCache** for production apps with ECS/Fargate requiring low-latency caching
- Use **Upstash** for Amplify deployments or apps with moderate caching needs

## Prerequisites

### For ElastiCache:
1. VPC with private subnets (SEC-1051)
2. Application security group (from ECS/Fargate - SEC-1047)
3. SNS topic for alarms (optional)

### For Upstash:
1. Upstash account (https://upstash.com/)
2. Redis database created
3. REST URL and token

## Variables

### Required Variables (ElastiCache)

| Variable | Description | Type |
|----------|-------------|------|
| `vpc_id` | VPC ID | string |
| `private_subnet_ids` | Private subnet IDs | list(string) |
| `app_security_group_ids` | App security group IDs | list(string) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `create_elasticache` | Create ElastiCache cluster | `true` |
| `use_upstash` | Using Upstash instead | `false` |
| `redis_node_type` | Instance type | `cache.t4g.micro` |
| `redis_num_cache_nodes` | Number of nodes | `2` |
| `redis_engine_version` | Redis version | `7.1` |
| `enable_encryption_at_rest` | Enable KMS encryption | `true` |
| `enable_encryption_in_transit` | Enable TLS | `true` |
| `snapshot_retention_limit` | Backup retention (days) | `7` |
| `enable_alarms` | Enable CloudWatch alarms | `true` |

See [variables.tf](./variables.tf) for complete list.

## Outputs

| Output | Description |
|--------|-------------|
| `redis_endpoint` | Primary endpoint address |
| `redis_port` | Redis port (6379) |
| `redis_connection_string` | Full connection string |
| `redis_auth_token_secret_arn` | Auth token in Secrets Manager |
| `deployment_info` | Summary of configuration |
| `estimated_monthly_cost` | Cost estimate |

See [outputs.tf](./outputs.tf) for complete list.

## Usage

### Option A: ElastiCache Redis

```hcl
module "redis" {
  source = "./infrastructure/redis"

  # Enable ElastiCache
  create_elasticache = true
  use_upstash        = false

  # Networking
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  app_security_group_ids  = [module.ecs.ecs_tasks_security_group_id]

  # Configuration
  redis_node_type       = "cache.t4g.micro"
  redis_num_cache_nodes = 2  # Primary + 1 replica for HA
  redis_engine_version  = "7.1"

  # Security
  enable_encryption_at_rest     = true
  enable_encryption_in_transit  = true

  # Backups
  snapshot_retention_limit = 7

  # Monitoring
  enable_alarms       = true
  alarm_sns_topic_arn = aws_sns_topic.alerts.arn

  # Environment
  environment = "production"
}
```

### Option B: Upstash Redis

```hcl
module "redis" {
  source = "./infrastructure/redis"

  # Use Upstash (no ElastiCache)
  create_elasticache = false
  use_upstash        = true

  # Store Upstash credentials in Secrets Manager
  store_upstash_in_secrets_manager = true
  upstash_redis_url                = var.upstash_url    # From Upstash console
  upstash_redis_token              = var.upstash_token  # From Upstash console

  environment = "production"
}
```

## Deployment

### ElastiCache Deployment

1. **Provision Infrastructure**:
   ```bash
   cd infrastructure/redis
   terraform init
   terraform plan -var="environment=production"
   terraform apply -var="environment=production"
   ```

2. **Get Connection Details**:
   ```bash
   # Get Redis endpoint
   terraform output redis_endpoint
   
   # Get auth token from Secrets Manager
   aws secretsmanager get-secret-value \
     --secret-id transparent-trust-redis-auth-token-production \
     --query SecretString --output text
   ```

3. **Configure Application**:
   ```typescript
   // In your application
   import Redis from 'ioredis';
   
   const redis = new Redis({
     host: process.env.REDIS_HOST,
     port: parseInt(process.env.REDIS_PORT),
     password: process.env.REDIS_AUTH_TOKEN,  // From Secrets Manager
     tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
   });
   ```

4. **Test Connection**:
   ```bash
   # Get auth token
   AUTH_TOKEN=$(aws secretsmanager get-secret-value \
     --secret-id transparent-trust-redis-auth-token-production \
     --query SecretString --output text)
   
   # Test connection
   redis-cli -h <endpoint> -p 6379 --tls --askpass ping
   # Enter auth token when prompted
   # Should return: PONG
   ```

### Upstash Deployment

1. **Create Upstash Database**:
   - Go to https://console.upstash.com/
   - Create new Redis database
   - Copy REST URL and token

2. **Store Credentials**:
   ```bash
   # Store in Secrets Manager
   aws secretsmanager create-secret \
     --name transparent-trust-upstash-redis-production \
     --secret-string '{"url":"https://...","token":"..."}'
   ```

3. **Configure Application**:
   The application already supports Upstash! Just set environment variables:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

## Application Integration

The Transparent Trust application uses Redis for rate limiting via Upstash.

### Current Implementation (Upstash)

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### To Use ElastiCache Instead

```typescript
// Switch to ioredis for ElastiCache
import { Redis } from 'ioredis';
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_AUTH_TOKEN,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
});

// Wrap ioredis to work with @upstash/ratelimit
const redisAdapter = {
  sadd: (key: string, ...members: string[]) => redis.sadd(key, ...members),
  eval: (...args: any[]) => redis.eval(...args),
  // Add other methods as needed
};

export const ratelimit = new Ratelimit({
  redis: redisAdapter as any,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

## Node Types and Pricing

### ElastiCache Node Types (us-east-1)

| Node Type | vCPU | Memory | Network | Price/Hour | Price/Month (2 nodes) |
|-----------|------|--------|---------|------------|----------------------|
| **cache.t4g.micro** | 2 | 0.5 GB | Low | $0.016 | ~$23 |
| **cache.t3.micro** | 2 | 0.5 GB | Low | $0.017 | ~$25 |
| **cache.t4g.small** | 2 | 1.37 GB | Low | $0.032 | ~$46 |
| **cache.t3.small** | 2 | 1.37 GB | Low | $0.034 | ~$50 |
| **cache.m7g.large** | 2 | 6.38 GB | Moderate | $0.149 | ~$215 |

**Recommendation**: 
- Development: `cache.t4g.micro` (1 node) - ~$12/month
- Production: `cache.t4g.micro` (2 nodes) - ~$23/month
- High traffic: `cache.t4g.small` or larger

### Upstash Pricing

- **Free Tier**: 10,000 commands/day
- **Pay-as-you-go**: $0.20 per 100,000 commands
- **Pro ($10/month)**: 1M commands + overages at $0.20/100K

**Cost Comparison Example** (1M commands/day):
- Upstash: ~$10/month (Pro plan)
- ElastiCache: ~$23/month (2x cache.t4g.micro)

## Monitoring

### CloudWatch Metrics

Key metrics to monitor:

- **CPUUtilization**: Should stay below 75%
- **DatabaseMemoryUsagePercentage**: Should stay below 90%
- **Evictions**: Number of keys evicted (indicates memory pressure)
- **SwapUsage**: Should be 0 (swap indicates memory issues)
- **CacheHitRate**: Percentage of successful reads from cache
- **CurrConnections**: Number of client connections

### Pre-Configured Alarms

This module creates alarms for:

1. **High CPU** (>75%): Scale up or optimize queries
2. **High Memory** (>90%): Add more nodes or increase node size
3. **Evictions** (>1000): Increase memory or optimize cache policies
4. **Swap Usage** (>50MB): Indicates memory pressure, scale up

### Viewing Metrics

```bash
# CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CPUUtilization \
  --dimensions Name=ReplicationGroupId,Value=transparent-trust-redis-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=ReplicationGroupId,Value=transparent-trust-redis-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## Scaling

### Vertical Scaling (Change Node Type)

```hcl
# Update variables
redis_node_type = "cache.t4g.small"  # Was cache.t4g.micro

# Apply changes
terraform apply
```

**Note**: This will cause a brief downtime during the change.

### Horizontal Scaling (Add Replicas)

```hcl
# Add more replica nodes
redis_num_cache_nodes = 3  # Was 2

# Apply changes
terraform apply
```

**Benefits**:
- Increased read capacity
- Better fault tolerance
- No downtime

## Backup and Recovery

### Automatic Backups

- Daily snapshots at configured time
- Retention: 7 days (configurable 0-35 days)
- Stored in S3 (encrypted)

### Manual Backup

```bash
# Create manual snapshot
aws elasticache create-snapshot \
  --replication-group-id transparent-trust-redis-production \
  --snapshot-name manual-backup-$(date +%Y%m%d)
```

### Restore from Backup

```hcl
# Add to main.tf
resource "aws_elasticache_replication_group" "redis" {
  # ... existing config ...

  snapshot_name = "manual-backup-20240101"  # Name of snapshot to restore
}
```

## Troubleshooting

### Common Issues

#### 1. Cannot Connect to Redis

**Symptom**: Connection timeout or refused

**Checks**:
```bash
# Check security group allows traffic
aws ec2 describe-security-groups \
  --group-ids <redis-sg-id> \
  --query 'SecurityGroups[0].IpPermissions'

# Check Redis cluster status
aws elasticache describe-replication-groups \
  --replication-group-id transparent-trust-redis-production \
  --query 'ReplicationGroups[0].Status'
```

**Solutions**:
- Ensure application security group is in `app_security_group_ids`
- Check if Redis is in same VPC as application
- Verify Redis cluster status is "available"

#### 2. High Memory Usage / Evictions

**Symptom**: Evictions alarm firing, cache hit rate dropping

**Checks**:
```bash
# Check memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=ReplicationGroupId,Value=transparent-trust-redis-production \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

**Solutions**:
- Scale up to larger node type
- Review cached data - are TTLs appropriate?
- Check if `maxmemory-policy` is set correctly (allkeys-lru)
- Consider adding more replica nodes

#### 3. Authentication Failures

**Symptom**: "NOAUTH Authentication required" errors

**Checks**:
```bash
# Verify auth token exists
aws secretsmanager get-secret-value \
  --secret-id transparent-trust-redis-auth-token-production

# Test connection with auth
redis-cli -h <endpoint> -p 6379 --tls --askpass ping
```

**Solutions**:
- Ensure `REDIS_AUTH_TOKEN` environment variable is set
- Verify auth token from Secrets Manager matches
- Check if TLS is enabled and application is using TLS connection

#### 4. High CPU Usage

**Symptom**: CPU alarm firing, slow response times

**Checks**:
```bash
# Check CPU over time
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CPUUtilization \
  --dimensions Name=ReplicationGroupId,Value=transparent-trust-redis-production \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum
```

**Solutions**:
- Scale up to larger node type
- Review Redis commands - avoid expensive operations (KEYS, SCAN large sets)
- Consider using read replicas to distribute load
- Enable connection pooling in application

## Security Best Practices

1. **Use Encryption**: Always enable encryption at rest and in transit
2. **Auth Token**: Use strong auth token stored in Secrets Manager
3. **Private Subnets**: Deploy Redis in private subnets only
4. **Security Groups**: Restrict access to application security group only
5. **No Public Access**: Never expose Redis to the internet
6. **Regular Updates**: Enable automatic minor version upgrades
7. **Backup Encryption**: Backups are encrypted by default
8. **IAM Policies**: Use least privilege for IAM access to Secrets Manager

## Migration: Upstash → ElastiCache

If migrating from Upstash to ElastiCache:

1. **Deploy ElastiCache** (this module)
2. **Update Application Code** to use ioredis instead of @upstash/redis
3. **Test in Staging** before production
4. **Deploy Application** with new Redis connection
5. **Monitor** cache hit rates and performance
6. **Decommission Upstash** once confident

## Cost Optimization

1. **Right-Size Nodes**: Start with t4g.micro, scale up if needed
2. **Use Graviton (t4g)**: 20% cheaper than t3 instances
3. **Disable Backups** in development: Set `snapshot_retention_limit = 0`
4. **Single Node** for dev/test: Set `redis_num_cache_nodes = 1`
5. **Review Cache TTLs**: Don't cache data longer than needed
6. **Monitor Evictions**: If zero evictions, you may be over-provisioned
7. **Consider Upstash** for low-traffic apps: Free tier is generous

## Related Documentation

- [AWS ElastiCache for Redis Documentation](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Upstash Documentation](https://docs.upstash.com/redis)
- [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)

## Support

For issues or questions:
- **Linear**: [SEC-1057](https://linear.app/montecarlodata/issue/SEC-1057)
- **AWS Support**: Check AWS Support Center
- **Terraform**: [ElastiCache Module Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/elasticache_replication_group)
