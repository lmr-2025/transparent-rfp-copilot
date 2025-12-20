---
id: 1806a2a9-ae7a-4f6d-9621-a8d9f06abdd3
title: 'Monte Carlo Data Protection, Privacy, and Compliance Framework'
categories:
  - Security & Compliance
created: '2025-12-19T20:35:52.371Z'
updated: '2025-12-19T20:50:59.740Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/pii-filtering.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/compliance.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/privacy.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/data-sampling.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/info-monte-carlo-collects.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/subprocessors-vendors.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
  - url: 'https://docs.getmontecarlo.com/docs/access-management.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:50:58.799Z'
  - url: 'https://docs.getmontecarlo.com/docs/data-protection-and-encryption.md'
    addedAt: '2025-12-19T20:35:52.314Z'
    lastFetchedAt: '2025-12-19T20:35:52.314Z'
active: true
---
## Data Protection and Encryption

### Encryption Standards
- **Data at rest**: AES-256 encryption for all stored data
- **Data in transit**: TLS 1.2 or higher with strong cipher suites
- **Device encryption**: Full-disk encryption on all Monte Carlo-managed mobile devices
- **Backup encryption**: All data backups encrypted using same standards as production data
- **Secure file transfer**: SFTP or HTTPS/TLS for authorized third-party data exchanges

### Key Management
- Formal Cryptography and Key Management Policy governs key lifecycle
- Periodic key rotation on scheduled triggers
- Key access restricted to authorized personnel only
- All key operations logged and monitored
- Customer-managed encryption keys supported in dedicated/hybrid deployments
- Keys rotated or destroyed upon data deletion for cryptographic unrecoverability

### Data Segmentation and Isolation
- **Logical separation**: Unique identifiers and access boundaries in application/database layers
- **Physical isolation**: Available in dedicated instance deployments
- **Multi-tenant security**: Robust separation controls in shared environments

### Business Continuity and Disaster Recovery
- Data replicated across multiple availability zones
- All replication and failover traffic encrypted
- DR testing conducted at least annually
- Multi-region failover available for dedicated instances

## Privacy Framework

### Privacy Commitment
- **Transparency**: Clear description of data collection, use, and sharing practices
- **Purpose limitation**: Data processed only for specific, defined purposes
- **Data minimization**: Retention only as long as necessary
- **Security**: Technical and organizational measures to safeguard personal data

### Regulatory Compliance
- **GDPR compliance**: European Union General Data Protection Regulation
- **EU-U.S. Data Privacy Framework**: International data transfer protections
- **Data Processing Addendum**: Available for customer contractual requirements

### Data Collection Categories
- **Metadata**: Table schemas, data freshness, volume metrics, BI report attributes
- **Metrics**: Row counts, byte counts, modification dates, table-level statistics
- **Query logs**: Query history, timestamps, user information, error logs
- **Aggregated statistics**: Null rates, distinct values, percentiles, statistical measures
- **Application data**: User accounts, settings, configurations, IP addresses, incidents
- **Unstructured data**: Metadata for documents, images, emails, logs
- **Data sampling**: Individual values/records for incident investigation (optional feature)

### PII Filtering and Protection
- **Automatic PII detection**: Regular expression-based identification of sensitive data
- **Real-time redaction**: Data filtered before reaching Monte Carlo infrastructure
- **Default rules**: Email addresses and US Social Security Numbers
- **Configurable filtering**: Individual rules can be enabled/disabled via API or CLI
- **Fail modes**: OPEN (continue processing) or CLOSE (stop on filtering errors)
- **Local processing**: In legacy deployments, redaction occurs on customer infrastructure

## Access Management

### Product Access Controls
- **Single Sign-On (SSO)**: SAML 2.0, Okta, Azure AD integration
- **Role-Based Access Control (RBAC)**: Granular permissions by user or team
- **SCIM provisioning**: Automated user lifecycle management
- **Least privilege**: Minimum necessary access configurations
- **Scoped permissions**: Access control by data source, workspace, or domain
- **Time-bound access**: Temporary access through enterprise identity platforms
- **Comprehensive audit logs**: User logins, configuration changes, administrative actions
- **Third-party integrations**: Scoped access using API tokens and OAuth

### Internal Access Controls
- **Least privilege model**: Minimal access for authorized personnel only
- **Multi-factor authentication (MFA)**: Required for all privileged systems
- **Quarterly access reviews**: Regular certification of access rights
- **Privileged session monitoring**: All administrative access logged and reviewed
- **24-hour access revocation**: Upon employee/contractor termination
- **Vendor due diligence**: Approved subprocessors with contractual protections

## Compliance Certifications

### Current Certifications
- **SOC 2 Type 2**: Annual audit with reports available by end of July
- **ISO 27001:2022**: Information security management certification
- **ISO 27017:2015**: Cloud security controls certification
- **ISO 27018:2019**: Personal data protection in cloud environments
- **Annual penetration testing**: Third-party security assessments

### Trust Center Resources
- Dedicated compliance documentation portal
- Customer notification subscriptions for new materials
- Compliance attestations and certificates available on request
- Contact: grc@montecarlodata.com for compliance questions

## Data Sampling Controls

### Optional Feature
- **Warehouse-level control**: Can be disabled for security/compliance reasons
- **Object storage**: Sampled data stored in secure object storage layer
- **Customer choice**: Small subset of customers choose to disable

### Affected Features When Disabled
- Value-based SQL rules and parameterized values
- Validation monitor set previews
- Advanced AI recommendations
- Root cause analyses and troubleshooting agent enhancements
- Breached rows viewing and metric investigation
- Common values in data profiler

## Subprocessors

### Personal Data Subprocessors
- **Amazon Web Services (AWS)**: Platform infrastructure and Bedrock LLM functionality
- **Snowflake**: Data warehouse services
- **Databricks**: Machine learning platform
- **LangChain (LangSmith)**: AI application observability

### Non-Personal Data Subprocessors
- **HashiCorp Vault**: Backend credential storage
- **RunLLM**: Support chat assistance

### Subprocessor Management
- All subprocessors undergo due diligence reviews
- Contractual data protection and confidentiality requirements
- Trust Center notifications for subprocessor updates
- Contact information available in Data Processing Addendum

## Common Questions

**Q: Is customer data encrypted at rest and in transit?**
A: Yes, using AES-256 for data at rest and TLS 1.2+ for data in transit.

**Q: What compliance certifications does Monte Carlo have?**
A: SOC 2 Type 2, ISO 27001, ISO 27017, ISO 27018, plus annual penetration testing.

**Q: Can PII be automatically filtered from collected data?**
A: Yes, PII filtering with regular expression rules can redact sensitive data before it reaches Monte Carlo infrastructure.

**Q: Does Monte Carlo support customer-managed encryption keys?**
A: Yes, in dedicated or hybrid deployment configurations.

**Q: How quickly is employee access revoked upon termination?**
A: Within 24 hours, typically by close of business on departure day.
