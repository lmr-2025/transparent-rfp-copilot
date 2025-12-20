---
id: 8d4a3cb3-4463-455c-8d41-925673051746
title: Monte Carlo Integration & Feature Release Lifecycle
categories:
  - Company
created: '2025-12-19T20:35:54.148Z'
updated: '2025-12-19T20:35:54.155Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/integration-feature-lifecycles.md'
    addedAt: '2025-12-19T20:35:54.120Z'
    lastFetchedAt: '2025-12-19T20:35:54.120Z'
active: true
---
## Release Process

Monte Carlo operates on a continuous deployment model that enables rapid customer feedback and iterative deployments of new integrations, features, and bug fixes. As a software-as-a-service platform, customer updates and management are not necessary - updates are continuously released automatically.

Notable new integrations, improvements, features, and bug fixes are documented in Monte Carlo's Change Log for customer reference.

## Release Phases

### Private Preview

Private preview serves as a pre-release testing phase with limited availability before wider distribution. This phase focuses on:

• Confirming functionality with select user groups
• Collecting feedback from invited participants
• Testing before broader release

**Private Preview Characteristics:**
• Participation by invitation only
• Subject to pre-general-availability terms
• May lack certain features
• No SLAs provided
• No technical support obligations

### Public Preview

Public preview makes integrations or features widely available for customer use with broader accessibility:

• Generally ready for most customer production use cases
• Often publicly announced
• Full technical support available
• May have functional, technical, scale, or other limitations
• Breaking changes may be implemented by Monte Carlo

**Database Integration Considerations:**
• Wide variety of database versions and deployment models can have minor effects on Monte Carlo's implementation
• Some integrations may remain in public preview until Monte Carlo has sufficient customer usage across a broad variety of environments
• Public preview status does not mean integrations are unfit for production use with Monte Carlo

### General Availability (GA)

General Availability represents the fully mature release stage:

• Accessible to all customers
• Covered by SLAs where applicable
• Full production readiness and support

## Common Questions

**Q: Does Monte Carlo require customer management for updates?**
A: No, Monte Carlo uses continuous deployment with automatic updates as a SaaS platform.

**Q: Are public preview features suitable for production?**
A: Yes, public preview features are generally ready for most customer production use cases, though they may have some limitations.

**Q: What support is available during different release phases?**
A: Private preview has no technical support obligations, while public preview and GA have full technical support available.

**Q: Do public preview features have SLAs?**
A: No, only General Availability features are covered by SLAs where applicable.

**Q: Can breaking changes occur in public preview?**
A: Yes, Monte Carlo may make breaking changes during the public preview phase.
