---
id: 5f4c5c09-39ce-4c73-863d-5286a056cc3b
title: Monte Carlo Business Intelligence (BI) Tool Integrations
categories:
  - Integrations
created: '2025-12-19T19:07:21.321Z'
updated: '2025-12-19T19:07:21.333Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/hex-beta.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/bi-tools.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/looker.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/troubleshooting-and-faqs-looker.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/mode.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/periscope-sisense.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/powerbi.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: >-
      https://docs.getmontecarlo.com/docs/power-bi-credential-creation-process.md
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
  - url: 'https://docs.getmontecarlo.com/docs/troubleshooting-and-faqs-power-bi.md'
    addedAt: '2025-12-19T19:07:21.286Z'
    lastFetchedAt: '2025-12-19T19:07:21.286Z'
active: true
---
## Overview

Monte Carlo integrates with various Business Intelligence tools to provide end-to-end Data + AI Observability across BI tools and data warehouses/lakes. These integrations automatically track metadata and lineage for dashboards, reports, and other BI assets.

## Supported BI Tools

### Hex Integration
- **Platform**: Data analysis platform using notebooks for data exploration and interactive visualizations
- **Setup**: Requires only data warehouse/lake integration - no direct Hex connection needed
- **Metadata Extraction**: Automatically extracts Hex project metadata from query logs
- **Lineage**: Visualizes dependencies between tables and Hex projects
- **Requirements**: Data warehouse(s) or lake(s) used in Hex must be connected to Monte Carlo

### Looker Integration
- **Capabilities**: Tracks metadata and lineage for dashboards, looks, dashboard-tiles, explores, and views
- **Dual Connection Required**: Both Looker API and Git repository connections needed for full lineage
- **API Connection**: Provides Looker-to-Looker lineage
- **Git Connection**: Required for warehouse-to-Looker lineage
- **Metadata Collection Frequency**: Every 4 days to minimize API usage
- **Connection Options**: SSH (more granular control) or HTTPS (recommended for multiple repos)

#### Looker API Setup Requirements
- Admin credentials required
- Permission set: `see_datagroups`, `access_data`, `access_data.see_lookml_dashboards`, `access_data.see_looks`, `access_data.see_looks.see_user_dashboards`, `access_data.see_looks.explore`, `access_data.see_looks.see_lookml`
- Role creation with appropriate model sets
- User creation with API key generation
- Content folder access configuration
- Host URL with port :19999 (for looker.com hosting)

#### Looker Git Integration Options
- **SSH Method**: Uses private/public key pairs for repository access
- **HTTPS Method**: Uses personal access tokens (requires `repo` access for GitHub)
- **Supported Platforms**: GitLab, Bitbucket, GitHub, and others

### Mode BI Integration
- **Platform**: Collaborative data analysis platform for reports, visualizations, and dashboards
- **Setup**: Requires only data warehouse/lake integration
- **Metadata Extraction**: Automatically extracts Mode dashboard metadata from query logs
- **Lineage**: Visualizes dependencies between tables and Mode reports

### Periscope/Sisense Integration
- **Status**: Public preview with potential functionality limitations
- **Setup**: Requires only data warehouse integration
- **Metadata Extraction**: Automatically extracts Periscope report metadata from query logs

### Power BI Integration
- **Assets Collected**: Datasets, Dashboards, Reports
- **Workspace Scanning**: Scans all available Power BI Workspaces
- **Lineage Parsing**: Parses Dashboard Tiles, Reports, and Dataset relationships
- **Data Source Support**: Google BigQuery, Snowflake, Databricks, Amazon Redshift
- **Authentication Options**: Service Principal (recommended) or Primary User (Classic workspaces only)

#### Power BI Setup Requirements
- **Service Principal Method**: Requires client ID, client secret, and tenant ID
- **Azure AD Security Group**: Must be created and configured
- **Power BI Admin Settings**: Enable service principals for Fabric APIs and Admin APIs
- **Workspace Access**: Service principal must be added to each workspace
- **Metadata Collection**: Assets appear within 1-5 hours, lineage within 24 hours

#### Power BI Limitations
- Inactive and Personal Workspaces not collected by default
- Dataflows not yet supported
- Field-level lineage not supported
- Only specific data sources supported

## General Integration Process

### Standard Setup Steps
1. **Network Connectivity**: Enable connectivity between BI tool and Monte Carlo if tool is not publicly accessible
2. **Service Accounts**: Create service accounts with appropriate permissions on BI tool
3. **Credential Configuration**: Provide service account credentials in Monte Carlo onboarding wizard
4. **Validation**: Test connection and verify asset visibility

### Integration Validation
- Assets should appear in Monte Carlo Assets page within 1-5 hours
- Validation tests available through Settings → Integrations
- Test button provides specific troubleshooting steps for connection issues
- Lineage may take up to 24 hours due to batching

## Troubleshooting Common Issues

### Looker-Specific Issues
- **Missing Assets**: Often due to permission issues - use SUDO function to verify access
- **SSH Key Errors**: Use `pbcopy` command to avoid extra spaces when copying keys
- **API Usage**: 4-day collection frequency means new assets may take up to 4 days to appear

### Power BI-Specific Issues
- **Workspace Allow List**: Can be configured to limit which workspaces are ingested
- **Service Principal Setup**: Changes take up to 15 minutes to apply
- **Asset Visibility**: Run validation tests if assets don't appear within expected timeframe

## Data Collection Frequency
- **Looker**: Every 4 days for API metadata
- **Power BI**: Varies by integration type (refer to data collection details documentation)
- **Other Tools**: Extracted from query logs during regular warehouse collection cycles

## Common Questions

**Q: Do I need to connect directly to my BI tool?**
A: For Hex, Mode, and Periscope, only warehouse integration is needed. For Looker and Power BI, direct connections are required.

**Q: How long does it take for BI assets to appear in Monte Carlo?**
A: Most assets appear within 1-5 hours, with lineage taking up to 24 hours due to batching.

**Q: What permissions are required for BI tool integrations?**
A: Generally read-only access is sufficient, but specific permission sets vary by tool (detailed in individual integration guides).

**Q: Can I limit which BI assets are collected?**
A: Yes, through content folder permissions (Looker) or workspace allow lists (Power BI).

**Q: What data sources are supported for Power BI lineage?**
A: Currently Google BigQuery, Snowflake, Databricks, and Amazon Redshift are supported.
