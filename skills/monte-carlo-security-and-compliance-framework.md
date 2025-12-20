---
id: 46d93d5e-3a32-44c4-a58e-b4647e19efab
title: Monte Carlo Security & Compliance Framework
categories: []
created: '2025-12-19T20:35:54.678Z'
updated: '2025-12-20T01:25:44.144Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: >-
      https://docs.getmontecarlo.com/docs/common-security-evaluation-questions.md
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/security-compliance-overview.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/ai-security.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/llm-training-observability.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/application-security.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/security.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/infrastructure-security.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/vulnerability-disclosure-policy.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/recipes/bulk-upload-field-tags.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/recipes/create-access-token.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: >-
      https://docs.getmontecarlo.com/recipes/create-domain-based-authorization-group-via-api.md
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/recipes/creating-domains-via-api.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/recipes/delete-access-token.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/recipes/mute-data-assets-using-regex.md'
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: >-
      https://docs.getmontecarlo.com/recipes/retrieve-existing-domain-names-and-uuids.md
    addedAt: '2025-12-19T20:35:54.652Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-sso-user-groups-and-permissions.md'
    addedAt: '2025-12-19T20:51:00.260Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/setting-up-single-sign-on-sso.md'
    addedAt: '2025-12-19T20:51:00.260Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
  - url: 'https://docs.getmontecarlo.com/docs/mapping-sso-authorization-groups.md'
    addedAt: '2025-12-19T20:51:00.260Z'
    lastFetchedAt: '2025-12-19T23:06:40.071Z'
active: true
---
## Overview

Monte Carlo is the leading Data + AI Observability Platform that helps data teams ensure reliable, high-quality data powers every decision. Security, privacy, and compliance are core to how Monte Carlo builds, deploys, and operates products because customers trust them with visibility into their most critical data systems.

## What Monte Carlo Does - test

Monte Carlo continuously monitors data ecosystems, from pipelines to dashboards, to detect and resolve data issues before they impact business. The platform helps companies:

• Detect data incidents before they reach decision-makers
• Track lineage across data stacks
• Monitor schema changes, freshness, and volume anomalies
• Improve trust in data across teams

## Deployment Options

Monte Carlo offers flexible deployment models that give customers full control over their data:

• **Hybrid Deployment Models**: Customers can host row-level data within their own environments
• **Customer-Controlled Access**: Granular RBAC, SSO/SAML, and SCIM integration for identity management
• **Flexible Architecture**: Built on AWS Well-Architected and CIS Benchmark guidelines

## Security Framework

### Infrastructure Security

Monte Carlo's infrastructure follows AWS Well-Architected and CIS Benchmark guidelines with enterprise-grade protections:

• **Compute**: AWS Lambda functions execute in isolated, short-lived containers with strictly scoped IAM permissions
• **Networking**: All communication passes through AWS API Gateway with encryption, rate limits, and request throttling
• **Access Control**: AWS IAM with least-privilege permissions, multi-factor authentication, short-lived credentials, and federated SSO
• **Monitoring**: 24/7 on-call security and engineering teams with centralized logging and SIEM integration
• **Hardening**: Continuous vulnerability identification and remediation through automated scanning and Infrastructure-as-Code reviews

### Application Security

Security is embedded into every phase of software development:

• **Secure Development Lifecycle**: Code undergoes static and dynamic analysis in CI/CD pipelines with peer review and approval
• **Vulnerability Testing**: Changes tested against OWASP Top 10 and CWE categories before deployment
• **Access Controls**: Role-Based Access Control (RBAC), Single Sign-On (SSO), and Multi-Factor Authentication (MFA)
• **Data Protection**: All data encrypted in transit and at rest using TLS 1.2+ and AES-256 encryption
• **Environment Isolation**: Development, staging, and production environments remain isolated
• **Change Management**: Formal change-management approvals with Infrastructure-as-Code and immutable build artifacts

### AI Security & Governance

Monte Carlo implements industry-standard security controls for AI-powered features aligned with NIST and ISO 42001 frameworks:

• **Model Management**: Documented inventory of all third-party AI models with use-case purpose, data flow, and vendor details
• **Data Protection**: Data encrypted at rest and in transit before interaction with external AI services, with minimum necessary data sent
• **Privacy Controls**: Customer data and AI prompts are not used to train external models, with contractual restrictions enforced
• **Access Controls**: Role-based and attribute-based access policies with MFA required for administrative and operational access
• **Input Validation**: Prompt and input validation enforced to prevent prompt injection, adversarial manipulation, and data leakage
• **Monitoring**: Continuous monitoring of AI model activity, API calls, and outbound data for unusual behavior

## Privacy Program

Privacy is foundational to Monte Carlo's operations:

• **Transparency**: Clear communication on what data is collected and why
• **Regulatory Compliance**: GDPR, CCPA, and EU-U.S. Data Privacy Framework compliant
• **Data Residency**: Options available for regional compliance requirements
• **Customer Tools**: Access and deletion request capabilities provided
• **Data Segregation**: Each customer's environment remains logically isolated

## Compliance Certifications

Monte Carlo maintains an independently audited compliance program meeting leading enterprise standards:

• **SOC 2 Type II**: Annual third-party audited compliance
• **ISO 27001**: Independently verified security management system
• **GDPR**: European data protection regulation compliance
• **CCPA**: California Consumer Privacy Act compliance
• **EU-U.S. Data Privacy Framework**: Cross-border data transfer compliance
• **AWS Shared Responsibility Model**: Clear delineation of security responsibilities

## Trust Center & Documentation

Monte Carlo provides comprehensive transparency through their Trust Center at https://trust.montecarlodata.com/, where customers can access:

• Audit attestations and reports
• Security certifications
• Compliance documentation
• Monte Carlo Shared Responsibility Matrix
• Subprocessor listings

## LLM Training & Observability

Monte Carlo uses pre-trained models via Amazon Bedrock without performing model training or fine-tuning:

• **Model Source**: Pre-trained models hosted entirely within Monte Carlo's AWS environment
• **No Training**: Monte Carlo does not fine-tune or retrain foundational models
• **Observability Tools**: Multi-layered monitoring using DataDog, Agent Observability, and LangSmith
• **Improvement Process**: Data-driven improvements guided by performance metrics and user feedback

## Vulnerability Disclosure

Monte Carlo maintains a responsible disclosure program:

• **Scope**: All Monte Carlo-owned web services (*.getmontecarlo.com, *.dev.getmontecarlo.com, *.montecarlodata.com)
• **Response Time**: Initial confirmation within 72 hours of submission
• **Resolution**: 90-day confidentiality period for researchers
• **Recognition**: Security Researcher Wall of Fame for qualifying discoveries
• **Contact**: security@montecarlodata.com for vulnerability reports

## Single Sign-On (SSO) Implementation

Monte Carlo supports comprehensive Single Sign-On authentication via SAML 2.0 with enterprise-grade identity management capabilities.

### SSO Configuration Requirements

• **SAML 2.0 Protocol**: Full SAML 2.0 compliance for enterprise identity providers
• **Service Provider-Initiated SSO**: Supported - users can start login flow from getmontecarlo.com/signin
• **Identity Provider-Initiated SSO**: Not currently supported - users cannot login directly from IdP tiles
• **NameID Format**: Unspecified format required for all identity providers
• **Domain-Based Authentication**: Users redirected to IdP based on email domain

### Required SAML Attributes

All identity providers must pass these mandatory attributes with specific claim names:

• **Email Address**: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
• **First Name**: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname
• **Last Name**: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname

### Supported Identity Providers

Monte Carlo provides specific configuration guidance for major enterprise identity providers:

• **Okta**: Uses user.email, user.firstName, user.lastName attributes
• **AWS SSO**: Uses ${user:email}, ${user:givenName}, ${user:familyName} variables
• **OneLogin**: Requires "SAML Custom Connector (Advanced)" with Service Provider initiator
• **Microsoft Entra ID**: Uses user.mail, user.givenname, user.surname with Unspecified Name ID format
• **Google SSO**: Custom SAML app through Google Admin with Basic Information fields
• **MyID**: Requires unspecified format for all attributes with Email as top-level attribute

### SSO Group Mapping

Monte Carlo supports automatic user provisioning through SSO group mapping:

• **Supported Providers**: Okta and Microsoft Entra ID
• **Group Attribute Name**: "User.Groups" for both Okta and Entra ID
• **Character Limit**: 2048 character limit for all groups passed in SAML assertion
• **Dynamic Membership**: Authorization group memberships updated on each user login
• **Default Groups**: Configurable default authorization group for users without mapped SSO groups

### SSO Security Considerations

• **API Key Impact**: User-level API keys are automatically revoked when migrating to SSO (account-level keys remain active)
• **Domain Enforcement**: All users on configured domains required to use SSO authentication
• **Account Identifiers**: Optional account identifiers to distinguish between multiple accounts with same domain
• **Metadata Configuration**: Supports both metadata URL and XML file upload for IdP configuration
• **SSO Bookmark Links**: Provides bookmark links for pseudo-IdP initiated login experience

## Customer Evaluation Guidance

When evaluating Monte Carlo, organizations should consider:

• Which data sources to configure for monitoring
• Whether monitored data contains sensitive or regulated information (PII, PHI, financial data)
• Appropriate access and visibility levels for organizational risk tolerance
• Internal data governance policies and data sensitivity requirements

Monte Carlo provides guidance and documentation during assessment but cannot determine data sensitivity or classification on behalf of customers. Organizations with stricter regulatory requirements may wish to conduct additional due diligence before enabling monitoring for highly sensitive environments.

## Common Questions

**Q: Do you encrypt data at rest and in transit?**
A: Yes, using AES-256 encryption for data at rest and TLS 1.2+ for data in transit.

**Q: What compliance certifications do you have?**
A: SOC 2 Type II, ISO 27001, GDPR, CCPA, and EU-U.S. Data Privacy Framework compliance.

**Q: Do you use customer data to train AI models?**
A: No, Monte Carlo does not use customer data or AI prompts to train external models, with contractual restrictions enforced.

**Q: What deployment options are available?**
A: Hybrid deployment models allowing customers to host row-level data within their own environments, with customer-controlled access via RBAC, SSO/SAML, and SCIM.

**Q: How do you handle vulnerability management?**
A: Through automated scanning, regular penetration testing, responsible disclosure program, and formal SLAs for remediation tracking.

**Q: What SSO providers do you support?**
A: SAML 2.0 compatible providers including Okta, AWS SSO, OneLogin, Microsoft Entra ID, Google SSO, and MyID with specific configuration guidance for each.

**Q: Can you map SSO groups to authorization groups?**
A: Yes, for Okta and Microsoft Entra ID, using "User.Groups" attribute with automatic user provisioning and dynamic membership updates.
