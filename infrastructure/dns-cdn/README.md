# DNS & CDN Infrastructure for Transparent Trust

Complete DNS and CDN infrastructure with Route 53, ACM certificates, optional CloudFront CDN, and AWS WAF.

**Reference**: [SEC-1059 - DNS & CDN Setup](https://linear.app/montecarlodata/issue/SEC-1059)

## Overview

This module provides production-ready DNS and CDN infrastructure including:
- **Route 53**: DNS management with health checks
- **ACM Certificates**: Free SSL/TLS certificates with auto-renewal
- **CloudFront CDN**: Optional global content delivery (disabled by default)
- **AWS WAF**: Optional web application firewall for CloudFront
- **Health Checks**: Automated monitoring with CloudWatch alarms

## Architecture Options

### Option 1: Direct ALB (Recommended for Most Cases)
```
User → Route 53 → ALB → ECS/Fargate
```
- Simplest setup
- Lower cost (~$0.50-1/month)
- Good for single-region applications
- Direct connection to ALB

### Option 2: CloudFront CDN
```
User → Route 53 → CloudFront → ALB → ECS/Fargate
```
- Global edge caching
- Better performance worldwide
- DDoS protection
- Optional WAF integration
- Higher cost ($1-5+/month depending on traffic)

## Quick Start

### Prerequisites
1. Domain name registered
2. Either create new hosted zone or have existing Route 53 hosted zone
3. ALB DNS name (from ECS/Fargate module)

### Basic Setup (Direct ALB)

```hcl
module "dns_cdn" {
  source = "./infrastructure/dns-cdn"

  # Domain configuration
  domain_name         = "transparenttrust.com"
  create_hosted_zone  = false  # Set to true if you need a new hosted zone
  include_wildcard    = true   # Include *.transparenttrust.com in certificate

  # ALB configuration (from ECS module)
  alb_dns_name = module.ecs.alb_dns_name
  alb_zone_id  = module.ecs.alb_zone_id

  # CloudFront disabled (direct to ALB)
  enable_cloudfront = false

  # Health check
  create_health_check       = true
  health_check_path         = "/api/health"
  health_check_alarm_actions = [module.monitoring.critical_alert_topic_arn]

  environment = "production"
}
```

### CloudFront Setup (Global CDN)

```hcl
module "dns_cdn" {
  source = "./infrastructure/dns-cdn"

  domain_name         = "transparenttrust.com"
  create_hosted_zone  = false
  include_wildcard    = true

  # CloudFront enabled
  enable_cloudfront         = true
  origin_domain_name        = module.ecs.alb_dns_name
  cloudfront_price_class    = "PriceClass_100"  # US, Canada, Europe
  enable_static_cache       = true              # Cache _next/static/* aggressively

  # Optional WAF
  enable_waf       = true
  waf_rate_limit   = 2000  # Max 2000 requests per 5 min per IP

  # Custom header for origin validation
  cloudfront_custom_header_value = random_password.cloudfront_secret.result

  # Caching behavior
  cloudfront_min_ttl     = 0
  cloudfront_default_ttl = 3600    # 1 hour
  cloudfront_max_ttl     = 86400   # 24 hours

  environment = "production"
}

# Generate random secret for CloudFront validation
resource "random_password" "cloudfront_secret" {
  length  = 32
  special = true
}
```

## Configuration Options

### Route 53

| Variable | Description | Default |
|----------|-------------|---------|
| `domain_name` | Primary domain (e.g., transparenttrust.com) | Required |
| `create_hosted_zone` | Create new hosted zone | `false` |
| `include_wildcard` | Include *.domain.com in certificate | `true` |

### CloudFront

| Variable | Description | Default |
|----------|-------------|---------|
| `enable_cloudfront` | Enable CloudFront CDN | `false` |
| `cloudfront_price_class` | Edge locations (see below) | `PriceClass_100` |
| `enable_static_cache` | Cache static assets aggressively | `true` |
| `cloudfront_default_ttl` | Default cache TTL (seconds) | `3600` |

**Price Classes**:
- `PriceClass_100`: US, Canada, Europe (lowest cost)
- `PriceClass_200`: Above + Asia, South Africa, South America
- `PriceClass_All`: All edge locations (highest performance)

### WAF

| Variable | Description | Default |
|----------|-------------|---------|
| `enable_waf` | Enable AWS WAF | `false` |
| `waf_rate_limit` | Max requests per 5 min per IP | `2000` |

WAF includes:
- AWS Managed Rules Core Rule Set
- Known Bad Inputs Rule Set
- Optional rate limiting

### Health Checks

| Variable | Description | Default |
|----------|-------------|---------|
| `create_health_check` | Create Route 53 health check | `true` |
| `health_check_path` | Health check endpoint | `/api/health` |
| `health_check_interval` | Check interval (10 or 30 seconds) | `30` |

## Setup Steps

### 1. Apply Terraform

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

### 2. Update Name Servers (if creating new hosted zone)

Get name servers from Terraform output:
```bash
terraform output hosted_zone_name_servers
```

Update at your domain registrar (e.g., GoDaddy, Namecheap):
1. Log in to domain registrar
2. Find DNS settings
3. Replace name servers with Route 53 name servers
4. Save changes

**Note**: DNS propagation can take 24-48 hours.

### 3. Verify DNS

```bash
# Check if DNS is working
dig transparenttrust.com

# Check name servers
dig NS transparenttrust.com

# Test HTTPS
curl -I https://transparenttrust.com
```

### 4. Update Application Configuration

Update `NEXTAUTH_URL` environment variable:
```bash
# In Secrets Manager or Parameter Store
NEXTAUTH_URL=https://transparenttrust.com
```

Restart your application for changes to take effect.

### 5. Configure ALB to Validate CloudFront (if using CloudFront)

Add listener rule to ALB to only accept traffic from CloudFront:

```hcl
# In your ALB module
resource "aws_lb_listener_rule" "cloudfront_only" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }

  condition {
    http_header {
      http_header_name = "X-Custom-Header"
      values           = [var.cloudfront_custom_header_value]
    }
  }
}
```

## CloudFront Cache Invalidation

When deploying new code, invalidate CloudFront cache:

```bash
# Invalidate all paths
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"

# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/_next/*" "/api/*"
```

**Cost**: First 1,000 invalidations per month are free, then $0.005 per path.

## Testing

### Test DNS Resolution
```bash
# A record
dig transparenttrust.com A

# AAAA record (IPv6)
dig transparenttrust.com AAAA

# All records
dig transparenttrust.com ANY
```

### Test SSL Certificate
```bash
# Check certificate
openssl s_client -connect transparenttrust.com:443 -servername transparenttrust.com

# Verify certificate chain
curl -vI https://transparenttrust.com
```

### Test CloudFront Caching
```bash
# First request (MISS)
curl -I https://transparenttrust.com

# Second request (HIT)
curl -I https://transparenttrust.com | grep -i x-cache
```

### Test Health Check
```bash
# Get health check status
aws route53 get-health-check-status \
  --health-check-id $(terraform output -raw health_check_id)
```

### Test WAF
```bash
# View WAF Web ACL
aws wafv2 get-web-acl \
  --scope=CLOUDFRONT \
  --id $(terraform output -raw waf_web_acl_id) \
  --region us-east-1

# View blocked requests
aws wafv2 get-sampled-requests \
  --web-acl-arn $(terraform output -raw waf_web_acl_arn) \
  --rule-metric-name RateLimitRuleMetric \
  --scope CLOUDFRONT \
  --time-window StartTime=2024-01-01T00:00:00Z,EndTime=2024-01-01T23:59:59Z \
  --max-items 100
```

## Cost Breakdown

### DNS Only (No CloudFront)
| Service | Cost |
|---------|------|
| Route 53 Hosted Zone | $0.50/month |
| Route 53 Queries | $0.40 per million (first 1B queries) |
| ACM Certificate | Free |
| Health Check | $0.50/month |
| **Total** | **~$1/month** |

### With CloudFront
| Service | Cost |
|---------|------|
| DNS (above) | $1/month |
| CloudFront Data Transfer | $0.085 per GB (US/Europe) |
| CloudFront Requests | $0.0075 per 10,000 HTTPS requests |
| CloudFront Invalidations | First 1,000/month free |
| **Total** | **$1-5+/month** (depending on traffic) |

**Example**: 10 GB transfer + 1M requests = $1 + $0.85 + $0.75 = ~$2.60/month

### With CloudFront + WAF
| Service | Cost |
|---------|------|
| CloudFront (above) | $1-5/month |
| WAF Web ACL | $5/month |
| WAF Rules | $1 per rule/month (2 managed rules = $2) |
| WAF Requests | $0.60 per million requests |
| **Total** | **$8-12+/month** |

## Troubleshooting

### DNS not resolving

**Issue**: `dig` returns NXDOMAIN

**Solution**:
1. Check name servers are updated at registrar
2. Wait for DNS propagation (up to 48 hours)
3. Verify hosted zone exists in Route 53
4. Check DNS record was created

### Certificate validation stuck

**Issue**: ACM certificate stuck in "Pending validation"

**Solution**:
1. Check DNS validation record was created in Route 53
2. Ensure name servers are correct
3. Wait up to 30 minutes for validation
4. Check validation record: `dig _acm-challenge.transparenttrust.com CNAME`

### CloudFront returning 502/503

**Issue**: CloudFront can't reach origin

**Solution**:
1. Verify ALB is healthy
2. Check ALB security group allows CloudFront IPs
3. Verify custom header is configured correctly
4. Check origin domain name is correct

### Health check failing

**Issue**: Route 53 health check shows unhealthy

**Solution**:
1. Verify health check path returns 200 OK
2. Check ALB target group health
3. Verify application is running
4. Test endpoint manually: `curl https://transparenttrust.com/api/health`

### High CloudFront costs

**Issue**: Unexpected CloudFront charges

**Solution**:
1. Review cache hit ratio in CloudFront metrics
2. Enable static asset caching (`enable_static_cache = true`)
3. Adjust TTL values to cache more aggressively
4. Consider using PriceClass_100 instead of PriceClass_All
5. Review CloudFront access logs to identify high-traffic endpoints

## Monitoring

### CloudWatch Metrics

**Route 53**:
- `HealthCheckStatus`: Health check status (1 = healthy, 0 = unhealthy)

**CloudFront**:
- `Requests`: Total requests
- `BytesDownloaded`: Data transferred
- `4xxErrorRate`: Client error rate
- `5xxErrorRate`: Server error rate
- `CacheHitRate`: Percentage of requests served from cache

**WAF**:
- `AllowedRequests`: Requests allowed
- `BlockedRequests`: Requests blocked
- `CountedRequests`: Requests counted

### Recommended Alarms

```hcl
# High 5xx error rate from CloudFront
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  alarm_name          = "cloudfront-high-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_actions       = [module.monitoring.critical_alert_topic_arn]

  dimensions = {
    DistributionId = module.dns_cdn.cloudfront_distribution_id
  }
}

# Low cache hit rate
resource "aws_cloudwatch_metric_alarm" "cloudfront_cache_hit" {
  alarm_name          = "cloudfront-low-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "50"
  alarm_actions       = [module.monitoring.warning_alert_topic_arn]

  dimensions = {
    DistributionId = module.dns_cdn.cloudfront_distribution_id
  }
}
```

## Security Best Practices

1. **Enable WAF** for CloudFront distributions
2. **Use custom header** to validate requests from CloudFront
3. **Restrict ALB security group** to only accept CloudFront traffic
4. **Enable health checks** to detect outages
5. **Monitor CloudWatch alarms** for anomalies
6. **Regularly review WAF logs** for attack patterns
7. **Use HTTPS only** (redirect HTTP to HTTPS)

## Related Documentation

- [AWS Route 53](https://docs.aws.amazon.com/route53/)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [CloudFront Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/best-practices.html)
- [AWS WAF](https://docs.aws.amazon.com/waf/)

## Support

For issues: [SEC-1059](https://linear.app/montecarlodata/issue/SEC-1059)
