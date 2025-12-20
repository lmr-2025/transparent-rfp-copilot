---
id: 846c76de-95be-48ab-a03a-94741bdf0988
title: Monte Carlo Hosting Architecture and Deployment Options
categories:
  - Product & Features
created: '2025-12-19T20:35:53.603Z'
updated: '2025-12-19T20:35:53.611Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: >-
      https://docs.getmontecarlo.com/docs/dedicated-instance-disaster-recovery.md
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
  - url: 'https://docs.getmontecarlo.com/docs/dedicated-instance.md'
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
  - url: 'https://docs.getmontecarlo.com/docs/hosting-architecture-options.md'
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
  - url: 'https://docs.getmontecarlo.com/docs/eu-regional-hosting-technical-specs.md'
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
  - url: 'https://docs.getmontecarlo.com/docs/eu-regional-hosting.md'
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
  - url: 'https://docs.getmontecarlo.com/docs/regional-hosting.md'
    addedAt: '2025-12-19T20:35:53.579Z'
    lastFetchedAt: '2025-12-19T20:35:53.579Z'
active: true
---
## Hosting Models Overview

Monte Carlo offers flexible hosting and architecture options to meet security, compliance, and operational requirements. All models provide the same level of reliability and data protection.

### Available Regions
- **US Region**: Primary validation and release region
- **EU Region**: Designed for GDPR compliance and EU data protection standards
- **Custom Regions**: Available upon request through Account Representative or support@montecarlodata.com

## Regional (Multi-Tenant) Hosting

Monte Carlo's standard deployment model serving multiple customers within a defined geographic region.

### Architecture Features
- **Shared Infrastructure**: Multiple customers served within geographic region
- **Logical Isolation**: Secure data and access separation between tenants through multi-layered access controls, encryption, and tenancy management
- **High Availability**: AWS multi-availability zones for resilience
- **Data Residency**: Processing remains within chosen region for regulatory compliance

### Regional Availability
- **US Regional Environment**: Primary region for feature validation and releases
- **EU Regional Environment**: GDPR-compliant processing within European Union
- **Domain Access**: US at standard domain, EU at https://eu1.getmontecarlo.com

### Feature Parity
- Full feature parity across regional environments as primary goal
- New features may appear in US region first before rolling out
- Core observability and monitoring capabilities consistent across regions
- Minor infrastructure differences may exist based on third-party service availability

## Dedicated Instance Hosting

*Currently in public preview*

Isolated instance of Monte Carlo's platform provisioned exclusively for individual organizations.

### Architecture and Isolation
- **Physical and Logical Isolation**: Dedicated environment within Monte Carlo's managed AWS infrastructure where possible
- **Dedicated Resources**: Compute, database, and networking resources dedicated where possible
- **Infrastructure Layer**: Isolated from other tenants at both infrastructure and application layers
- **Unique Access**: Each instance accessible through unique subdomain

### Shared vs Dedicated Resources
- **Dedicated**: Core application services, data pipelines, storage layers
- **Shared**: Certain third-party vendor services, development/build/analytics tools, underlying cloud vendor infrastructure
- **Note**: Not all vendors support full isolation or dedicated tenancy

### Network and Access Configuration
- **Domain Restrictions**: Access can be restricted to approved corporate domains
- **Private Connectivity**: Azure or AWS PrivateLink available for secure private network routing
- **Hybrid/Multi-Cloud**: Optional Azure PrivateLink connectivity for hybrid architectures
- **Post-Deployment Changes**: Connectivity options can be enabled or adjusted after instance creation

### Feature Availability
- **Functional Parity**: Maintains same features as regional hosting environments
- **Limited Features**: Small number of ancillary or vendor-dependent features may not be available (e.g., Snowflake Native Apps, legacy data collectors)
- **Update Schedule**: Feature updates rolled out alongside main SaaS platform and validated across environments

## Dedicated Instance with Disaster Recovery

*Multi-region failover currently in private preview*

Extends dedicated hosting model to support continuity during regional cloud outages.

### Architecture and Configuration
- **Secondary Instance**: Monte Carlo provisions secondary instance in another supported cloud region
- **Data Synchronization**: Critical data resources including monitoring metadata and configuration state continuously synchronized
- **Replication Strategy**: Core platform components use near real-time replication, less critical services use periodic snapshots
- **Resource-Specific Strategy**: Failover approach determined by vendor support, recovery priority, and operational overhead

### Failover Process
- **Coordination**: Monte Carlo engineering team coordinates failover based on incident severity and service impact
- **Trigger Criteria**: Failover initiated only during significant or sustained regional outage, not for transient disruptions
- **Built-in Resiliency**: Most localized disruptions mitigated through existing resiliency mechanisms
- **Downtime Window**: Brief downtime expected during service transition between regions

### Testing and Validation
- **Annual Testing**: Customers may request failover simulation once per year with advance notice
- **Validation Purpose**: Confirms networking and integrations perform as expected during regional transition
- **Readiness Verification**: Validates overall disaster recovery readiness

### Scope and Limitations
- **Covered Services**: Core Monte Carlo application services including monitoring, detection, and alerting infrastructure
- **Excluded Components**: Agents, data store, data sharing do not participate in failover
- **Business Continuity**: Designed to meet high availability and business continuity objectives

## EU Regional Hosting Specifications

*Currently in public preview*

### Data Classification and Residency
Monte Carlo categorizes services by customer data interaction to determine hosting location:

#### Regional (EU-Hosted) Services
- Services directly interacting with customer-monitored data
- AWS, Snowflake, Databricks, and related processing components
- Core Infrastructure: S3, RDS, DynamoDB (limited Global Tables), OpenSearch, EFS
- Compute: ECS, Lambda, Airflow, Glue
- Processing: Kinesis, SQS, SNS
- Application Layer: API Gateway, AWS Amplify (regional UI hosting)
- LLMs: AWS Bedrock (availability varies by region)
- Third-parties: Azure, Snowflake, Databricks, Neo4j, Timescale, HashiCorp Vault (HCP)

#### Non-Regional (US-Hosted) Services
- Services not processing customer monitored data
- Authentication and operational tools (Okta, Slack)
- Build and deployment tools (GitHub Actions, Terraform Cloud)
- Observability: DataDog, Sentry

#### Regional Observability Services
- Mixpanel (processes customer usage data)

### Architecture Principles
- **Regional Isolation**: Customer environments provisioned in EU-based data centers
- **Centralized Governance**: All accounts managed under Monte Carlo AWS Organization
- **Scalable Design**: Supports both single-tenant (dedicated) and multi-tenant (shared) instances
- **Account Structure**: Each EU environment operates with dedicated AWS account

### Global and Shared Services
Certain services enable consistent user experience across regions without processing customer-monitored data:
- **Discovery Service**: Routes users to correct environment (eu1.getmontecarlo.com)
- **API Routing Service**: Single global entry point (api.getmontecarlo.com) with regional bypass option (api.eu1.getmontecarlo.com)
- **Integration Routing**: Routes webhooks and OAuth requests to correct tenant
- **CloudFront CDN**: Global web asset delivery for low latency
- **Cross-Region Features**: Some AWS resources in non-EU regions to support regional features like PrivateLink

### Feature Limitations in EU Region
- Snowflake Native Apps (SNA)
- Legacy Data Collectors (including S3 event collection)
- Sharing API Explorer queries
- Status Pages
- GitLab limitation: Must use eu1.getmontecarlo.com/auth/callback/gitlab instead of getmontecarlo.com/integration-redirect/gitlab

### Account Information Access
- **Domain**: https://eu1.getmontecarlo.com
- **Account Info Page**: https://eu1.getmontecarlo.com/account-info
- **Privacy Contact**: privacy@montecarlodata.com for full service list

### Auxiliary Services
- Monte Carlo operates as international, remote-first company headquartered in US
- Company operational services (billing, support) typically hosted in United States
- Monte Carlo employees may provide services from non-EU regions as needed
- Contact Account Representative or privacy@montecarlodata.com for specific concerns

## Common Questions

**Q: What hosting options does Monte Carlo offer?**
A: Regional (multi-tenant), Dedicated Instance, and Dedicated Instance with Disaster Recovery.

**Q: Which regions are available?**
A: US and EU regions are standard, with custom regions available upon request.

**Q: Does EU hosting ensure GDPR compliance?**
A: Yes, EU regional hosting is designed for GDPR compliance with data processing remaining within the EU.

**Q: Can dedicated instances fail over between regions?**
A: Yes, multi-region failover is available as an additional option for dedicated instances (currently in private preview).

**Q: Are all features available in all regions?**
A: Monte Carlo aims for feature parity, though some legacy or region-specific features may have limitations in certain regions.
