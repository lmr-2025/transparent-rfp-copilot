---
id: 23a58b0f-0966-4a95-99d8-8dc4d01c43a6
title: Monte Carlo Hosting Architecture Options and Disaster Recovery
categories:
  - Product & Features
tier: library
created: '2025-12-28T19:20:58.244Z'
updated: '2025-12-28T19:20:58.268Z'
owners:
  - name: lross
    email: lross@montecarlodata.com
    userId: cmjp90c7u0000irtgwtbg4t2p
sources:
  - url: >-
      https://docs.getmontecarlo.com/docs/dedicated-instance-disaster-recovery.md
    addedAt: '2025-12-28T19:20:58.198Z'
    lastFetchedAt: '2025-12-28T19:20:58.198Z'
  - url: 'https://docs.getmontecarlo.com/docs/dedicated-instance.md'
    addedAt: '2025-12-28T19:20:58.198Z'
    lastFetchedAt: '2025-12-28T19:20:58.198Z'
  - url: 'https://docs.getmontecarlo.com/docs/hosting-architecture-options.md'
    addedAt: '2025-12-28T19:20:58.198Z'
    lastFetchedAt: '2025-12-28T19:20:58.198Z'
  - url: 'https://docs.getmontecarlo.com/docs/eu-regional-hosting-technical-specs.md'
    addedAt: '2025-12-28T19:20:58.198Z'
    lastFetchedAt: '2025-12-28T19:20:58.198Z'
  - url: 'https://docs.getmontecarlo.com/docs/eu-regional-hosting.md'
    addedAt: '2025-12-28T19:20:58.198Z'
    lastFetchedAt: '2025-12-28T19:20:58.198Z'
active: true
---
## Regional (Multi-Tenant) Hosting

### Overview
- Monte Carlo's standard regional deployment designed for simplicity, scalability, and strong logical isolation
- Shared infrastructure serving multiple customers within a defined geographic region
- Logical data and access isolation between tenants through multi-layered access controls, encryption, and tenancy management
- Available in US and EU regions
- For non-US or EU regions, contact Account Representative or support@montecarlodata.com

### EU Regional Hosting
- Domain: https://eu1.getmontecarlo.com
- Account information accessible at: https://eu1.getmontecarlo.com/account-info
- Feature limitations in EU region:
  - Snowflake Native Apps (SNA) not available
  - Legacy Data Collectors (including S3 event collection) not available
  - Sharing API Explorer queries not available
  - Status Pages not available
  - GitLab limitation: must use `eu1.getmontecarlo.com/auth/callback/gitlab` instead of `getmontecarlo.com/integration-redirect/gitlab`

#### EU Data Residency and Compliance
- Enables customers to monitor and manage data quality within the European Union
- Aligns with data residency, compliance, and governance requirements such as GDPR
- Maintains same reliability, observability, and security standards as US environments
- Customer data monitored through the platform remains within the EU
- Currently in public preview

#### EU Data Classification
Monte Carlo categorizes all services by how they interact with customer data:

**Regional (EU-Hosted) Services:**
- Services that directly interact with customer-monitored data
- Includes AWS, Snowflake, Databricks, and related processing components

**Non-Regional (US-Hosted) Services:**
- Services that do not process customer monitored data
- Authentication and operational tools (e.g., Okta, Slack)
- Build and deployment tools (e.g., GitHub Actions, Terraform Cloud)

**Instrumentation and Observability:**
- Operational telemetry services evaluated case-by-case
- Non-Regional examples: DataDog, Sentry
- Regional examples: Mixpanel

#### EU Architecture and Design Principles
- Regionalized architecture designed for logical isolation, resilience, and compliance
- Each EU environment operates within broader Monte Carlo AWS Organization with dedicated AWS account
- Regional isolation: Customer environments provisioned in EU-based data centers
- Centralized governance: Consistent policy enforcement and monitoring
- Scalable design: Supports both single-tenant (dedicated) and regional multi-tenant (shared) instances

#### EU-Hosted Infrastructure Components
**Core Infrastructure (AWS) Examples:**
- Storage: Amazon S3, RDS, DynamoDB (limited Global Tables usage), OpenSearch, Elastic File System
- Compute: ECS, Lambda, Airflow, Glue
- Processing: Kinesis, SQS, SNS
- Application Layer: API Gateway, AWS Amplify (regional UI hosting)
- LLMs: AWS Bedrock (availability varies by region)

**Additional Third-Parties:**
- Azure, Snowflake, Databricks, Neo4j, Timescale, HashiCorp Vault (HCP)

#### Shared and Global Services
- Enable consistent, performant user experience across all regions
- Not used for storing or processing customer-monitored data
- Support global login, API routing, and UI delivery

**Example Services:**
- Discovery Service: Routes users to correct environment (e.g., eu1.getmontecarlo.com)
- API Routing Service: Single global entry point (api.getmontecarlo.com) for SDK and CLI access
  - Note: Customers may bypass routing using regional endpoint directly (e.g., https://api.eu1.getmontecarlo.com/)
- Integration Routing: Routes incoming integration webhooks and OAuth requests to correct tenant
- CloudFront CDN: Delivers web assets globally for low latency
- Snowflake Data Sharing (cross-cloud and cross-region)
- Some AWS resources supporting regional features (e.g., PrivateLink VPC peering)

#### Auxiliary Services
- Monte Carlo operates as international, remote-first company headquartered in United States
- Services for company operations and product support (billing, support) typically hosted in US
- Monte Carlo employees may provide services from non-EU regions as needed
- For specific concerns, contact Account Representative or privacy@montecarlodata.com

## Dedicated Instance Architecture

### Deployment Model
- Each dedicated instance runs as its own managed environment, isolated from other tenants at both infrastructure and application layers
- Monte Carlo provisions these environments within AWS
- Optional Azure PrivateLink connectivity available for customers using hybrid or multi-cloud architectures
- Core application services, data pipelines, and storage layers are dedicated per customer
- Certain underlying vendor systems (analytics, telemetry services) may continue to operate in shared infrastructure layer to support platform operations
- Feature currently in public preview
- Provides physically and logically isolated environment within Monte Carlo's managed AWS infrastructure where possible
- Dedicated resources (compute, database, and networking) where possible
- Greater control over configuration, networking, and access

### Shared vs Dedicated Resources
- Instance is a form of "single-tenant" architecture with key distinctions:
  - Certain resources, third-party vendor services, and development, build, or analytics tools may still be shared across environments
  - Underlying cloud and vendor infrastructure may be shared among other Monte Carlo customers or external users
  - Resources not necessarily deployed on dedicated tenancy, nor is full isolation supported by all vendors

### Access and Configuration
- Each dedicated instance accessible through unique subdomain
- Access can be restricted to approved corporate domains
- Only authorized users can register or log in when domain restrictions are enabled
- Network connectivity follows same principles as Monte Carlo's regional environments with additional customization options
- Azure or AWS PrivateLink can be configured to route traffic securely through private network endpoints instead of public internet
- PrivateLink connectivity options can be enabled or adjusted at any time after instance creation

### Feature Availability
- Dedicated instances maintain functional parity with Monte Carlo's regional hosting environments
- Small number of ancillary or vendor-dependent features may not be available in every dedicated deployment:
  - Snowflake Native Apps
  - Legacy data collectors
- Feature updates rolled out alongside main SaaS platform and validated across environments

## Disaster Recovery (Multi-Region Failover)

### Overview
- Multi-region failover extends Monte Carlo's dedicated hosting model to support continuity during regional cloud outages
- Platform fails over from primary to secondary cloud region when DR is enabled
- Operations can resume with minimal disruption
- Provides additional layer of resilience for organizations requiring high availability or business continuity assurance
- Feature currently in private preview
- Available as additional option for Dedicated Instances
- Replicates environment across regions to ensure resilience and business continuity
- Enables failover between two regions
- Maintains near real-time replication between primary and secondary environments
- Designed to meet high availability and business continuity objectives

### DR Architecture
- Monte Carlo provisions secondary instance of dedicated environment in another supported cloud region
- Critical data resources continuously synchronized, including:
  - Monitoring metadata
  - Configuration state
- Core platform components use near real-time replication
- Less critical or vendor-managed services mirrored through periodic snapshots
- Specific failover strategy for each resource determined by vendor support, recovery priority, and operational overhead

### Failover Process
- Monte Carlo's engineering team coordinates failover process based on incident severity and service impact
- Not every outage triggers regional failover
- Most transient or localized disruptions mitigated through Monte Carlo's built-in resiliency mechanisms
- Failover initiated only during significant or sustained regional outage
- Brief downtime window expected while services transition between regions

### Testing and Validation
- Customers may request failover simulation once per year with advance notice
- Simulation validates readiness and confirms networking and integrations perform as expected during regional transition

### DR Scope and Limitations
- Disaster Recovery covers core Monte Carlo application services:
  - Monitoring infrastructure
  - Detection infrastructure
  - Alerting infrastructure
- Components that do NOT participate in failover:
  - Agents
  - Data store
  - Data sharing functionality

## Common Questions

**Q: What hosting options does Monte Carlo offer?**
A: Monte Carlo offers Regional (Multi-Tenant) Hosting in US and EU regions, and Dedicated Instances with optional Multi-Region Failover for disaster recovery.

**Q: Is the dedicated instance completely isolated from other customers?**
A: Yes, at both infrastructure and application layers, though some underlying vendor systems may be shared.

**Q: Can we use private network connectivity?**
A: Yes, Azure or AWS PrivateLink can be configured for secure private network routing.

**Q: How often can we test disaster recovery?**
A: Customers may request one failover simulation per year with advance notice.

**Q: What components are not covered by disaster recovery?**
A: Agents, data store, and data sharing functionality do not participate in failover.

**Q: Do dedicated instances have the same features as the main platform?**
A: Yes, functional parity is maintained, except for some vendor-dependent features like Snowflake Native Apps.

**Q: What are the feature limitations in EU regional hosting?**
A: EU region does not support Snowflake Native Apps, Legacy Data Collectors, Sharing API Explorer queries, Status Pages, and has GitLab integration limitations.

**Q: How does Monte Carlo ensure EU data residency compliance?**
A: Monte Carlo categorizes services by customer data interaction, hosts data-processing services in EU regions, and maintains customer-monitored data within EU boundaries while supporting GDPR compliance.

**Q: Can customers bypass global API routing in EU deployments?**
A: Yes, customers can use regional endpoints directly (e.g., https://api.eu1.getmontecarlo.com/) instead of the global routing service.
