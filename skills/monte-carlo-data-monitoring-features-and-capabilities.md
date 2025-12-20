---
id: 2dd934b6-cf4b-44e6-8527-efe8eaf42ae3
title: Monte Carlo Data Monitoring Features and Capabilities
categories:
  - Product & Features
created: '2025-12-19T16:47:43.525Z'
updated: '2025-12-20T21:13:52.365Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/data-profiler.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T18:31:01.396Z'
  - url: 'https://docs.getmontecarlo.com/docs/json-schema-monitor.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T18:31:01.396Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-comparison-rules.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T18:31:01.396Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-freshness.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T18:31:01.396Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-metric-monitor.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-monitors-as-code.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-schema.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-volume.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/tags.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/using-assets.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/dashboards.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/data-quality.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/activity-dashboard.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/data-operations-dashboard.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
  - url: 'https://docs.getmontecarlo.com/docs/cleanup-suggestions.md'
    addedAt: '2025-12-20T21:13:51.656Z'
    lastFetchedAt: '2025-12-20T21:13:51.656Z'
active: true
---
## Data Profiler

The Data Profiler is a core feature of Monte Carlo that provides comprehensive data analysis and monitoring capabilities.

### Key Features
- Automated data profiling to understand data characteristics and patterns
- Recommended Monitors functionality that suggests appropriate monitoring configurations based on data analysis
- Integration with Monte Carlo's broader monitoring ecosystem
- Video training resources available for implementation guidance

### Use Cases
- Understanding data structure and quality patterns
- Generating intelligent monitoring recommendations
- Establishing baseline data quality metrics

## JSON Schema Monitor

The JSON Schema Monitor provides specialized monitoring for JSON data structures and schema validation.

### Capabilities
- Monitors JSON data structures for schema compliance
- Validates JSON data against predefined schemas
- Detects schema violations and structural anomalies
- Provides alerts when JSON data doesn't conform to expected schemas

### Implementation
- Step-by-step guidance available through video tutorials
- Can be configured to monitor specific JSON fields and structures
- Integrates with Monte Carlo's alerting system

## Comparison Rules

Comparison Rules enable sophisticated data validation by comparing data across different sources, time periods, or conditions.

### Core Functionality
- Set up custom comparison logic between datasets
- Compare data across different time periods, sources, or environments
- Define specific rules for data validation and quality checks
- Monitor data consistency across multiple systems

### Features
- Results display showing comparison outcomes
- Recent alerts tracking for comparison rule violations
- Run history to track comparison rule execution over time
- Change logs to monitor modifications to comparison rules
- Configurable alerting when comparison thresholds are exceeded

## Freshness Monitor (ML)

The Freshness Monitor uses machine learning to detect when data becomes stale or outdated.

### Machine Learning Capabilities
- Automatically learns normal data refresh patterns
- Detects anomalies in data freshness without manual threshold setting
- Adapts to changing data patterns over time
- Provides intelligent alerting for data staleness

### Configuration Options
- Customizable freshness thresholds for specific use cases
- Flexible alerting configurations
- Integration with Monte Carlo's alert management system

### Alert Features
- Visual representation of freshness violations in Monte Carlo interface
- Detailed freshness metrics and trends
- Historical freshness performance tracking

## Metric Monitor

The Metric Monitor provides comprehensive monitoring of custom business and data metrics.

### Monitoring Capabilities
- Track custom business metrics and KPIs
- Monitor data quality metrics across datasets
- Set up threshold-based alerting for metric violations
- Historical metric tracking and trend analysis

### Implementation
- Video tutorials available for setup and configuration
- Flexible metric definition and calculation options
- Integration with existing data pipelines and workflows

## Monitors as Code

Monitors as Code enables programmatic management of Monte Carlo monitoring configurations.

### Key Features
- Define monitoring configurations using YAML syntax
- Version control monitoring configurations alongside code
- Programmatic deployment and management of monitors
- Export existing UI-configured monitors to YAML format

### Capabilities
- Pull YAML configurations from existing UI-based monitors
- Automated deployment of monitoring configurations
- Integration with CI/CD pipelines
- Consistent monitoring setup across environments

### Benefits
- Infrastructure as Code approach for data monitoring
- Reproducible monitoring configurations
- Team collaboration on monitoring setup
- Automated monitoring deployment

## Schema Monitor

The Schema Monitor tracks and alerts on database and table schema changes.

### Schema Change Detection
- Automatic detection of schema modifications
- Tracking of column additions, deletions, and type changes
- Monitoring of table structure modifications
- Index and constraint change detection

### Alert Management
- Configurable alerting for schema changes
- Muting options for expected schema modifications
- Daily digest functionality for schema change summaries
- Integration with Monte Carlo's notification system

### Visualization
- Schema changes displayed on assets page
- Historical schema change tracking
- Visual representation of schema evolution over time
- Detailed change logs and audit trails

## Volume Monitor (ML)

The Volume Monitor uses machine learning to detect anomalies in data volume and row counts.

### Machine Learning Features
- Automatic learning of normal data volume patterns
- Anomaly detection for unusual data volume changes
- Adaptive thresholds that adjust to data patterns
- Intelligent alerting for volume anomalies

### Configuration Options
- Adjustable sensitivity settings for volume threshold detection
- Customizable anomaly detection parameters
- Flexible alerting configurations
- Historical volume trend analysis

### Anomaly Detection
- Detects both increases and decreases in data volume
- Identifies seasonal patterns and adjusts accordingly
- Provides context for volume anomalies
- Integration with Monte Carlo's incident management system

## Asset Tags

Asset tags provide data governance capabilities for organizing and classifying data assets.

### Overview
- Key-value pairs used to attach metadata to assets
- Support for logical grouping of assets meaningful to organizations
- Can be applied via Monte Carlo UI or API
- Integration with source system tags (Snowflake, BigQuery, dbt)

### Tag Import Sources
- **Snowflake**: Requires enablement, imports from SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES table
- **BigQuery**: Automatic ingestion of table-level labels and descriptions
- **dbt**: Automatic collection from manifest files

### Tag Management
- Metadata collection occurs hourly for source system updates
- Monte Carlo tags take precedence over imported tags with same key names
- Source system tag deletions sync to Monte Carlo
- Tags imported from sources are clearly indicated in the interface

## Assets (Data Catalog)

Assets (formerly called Catalog) provides comprehensive data discovery and asset management capabilities.

### Discovery and Navigation
- Free-form search functionality with tag filtering
- Detailed asset pages with comprehensive information
- Summary view showing current state, lineage, and usage patterns
- General Information tab with descriptions, usage data, and importance scores

### Monitoring Views
- **Freshness Tab**: Visual graphs showing update patterns and detector status
- **Volume Tab**: Row count trends with automated volume monitoring
- **Schema Changes Tab**: Column modification tracking with current schema viewer
- **Custom Monitors Tab**: Overview of configured monitors with search and filtering
- **Field Profile Tab**: Statistics from Field Health monitors

### Lineage and Query Analysis
- **Table Lineage**: Upstream and downstream data flow visualization
- **Field Lineage**: Column-level lineage tracking with Field Health monitor integration
- **Query Logs**: Comprehensive query history including reads, writes, and user activity
- **Query Comparison**: Side-by-side diff functionality for query analysis

### Alert and Impact Analysis
- **Past Alerts**: Historical alert tracking with links to Alert IQ
- **Reports Affected**: Downstream BI report impact analysis
- Filter capabilities for specific report types and searches

## Dashboards

Monte Carlo provides multiple dashboard types for different operational needs.

### Available Dashboard Types
- **Table Health Dashboard**: Asset-specific health monitoring
- **Data Reliability Dashboard**: Overall system reliability metrics
- **Data Quality Dashboard**: Monitor-specific quality scoring
- **Activity Dashboard**: User activity and monitor creation tracking
- **Data Operations Dashboard**: Team operational metrics and incident management
- **Insights Reports**: Specialized analytical reports

## Data Quality Dashboard

The Data Quality Dashboard provides comprehensive quality measurement and reporting capabilities.

### Core Functionality
- Monitor-based quality scoring for SLAs and data contracts
- Support for Validation, Comparison, and Custom SQL monitors
- Tag-based filtering for specific teams, projects, or data products
- Current state scoring and historical trend analysis

### Data Quality Score Calculation
- Current score: Percentage of monitors passing on last run
- Trend score: Daily aggregation of successful vs. total monitor runs
- Considerations for monitor frequency and scheduling differences

### Data Quality Dimensions
Six key dimensions with specific monitor type support:

1. **Accuracy**: Custom logic validation and cross-asset comparison
2. **Completeness**: Null value monitoring and volume tracking
3. **Consistency**: Schema drift detection and format uniformity
4. **Timeliness**: Freshness monitoring within expected windows
5. **Validity**: Business rule verification and schema adherence
6. **Uniqueness**: Duplicate detection in unique ID columns

### Monitor Management
- Dimension assignment through UI, bulk operations, or Monitors as Code
- Support for explicit thresholds in Freshness and Volume monitors
- Detailed alerting monitor analysis with invalid record drilling

## Activity Dashboard

The Activity Dashboard tracks user engagement and monitor creation metrics.

### Stack Summary
- Integration and asset overview (not suitable for usage tracking)
- Approximate summary of monitored assets across integrations

### User Activity Metrics
- Active users within Monte Carlo UI during lookback periods
- Page view counting and tracking
- Last activity timestamps for user engagement analysis
- Day-over-day, week-over-week, and month-over-month trending

### Monitor Creation Tracking
- Custom monitor creation counts during specified periods
- Active monitor totals across the environment
- Trend analysis for monitor development activity
- Note: Deleted monitors not counted in creation metrics

## Data Operations Dashboard

The Data Operations Dashboard provides team operational metrics and incident management insights.

### Overview
- 12-month operational metrics view
- Alert response time tracking
- Incident severity and resolution analysis
- Updates every 12 hours for long-term trend analysis

### Filtering and Customization
- Domain-based filtering
- Data Product categorization
- Table and Monitor tag filtering
- Audience-based segmentation
- Custom dashboard creation with saved filters

### Key Metrics
- **Incidents**: Severity-marked alerts requiring resolution work
- **Acknowledged Alerts**: Alerts that have been acknowledged, marked as incidents, or resolved
- **Total Alerts**: Complete alert volume from Monte Carlo
- **Time to Response**: Alert acknowledgment speed measurement
- **Time to Resolution**: Incident resolution duration tracking
- **Incident Classification**: Type and severity breakdown analysis

### Best Practices
- Monthly review cadence recommended
- Incident marking for confirmed issues requiring work
- Response time measurement for team performance
- Resolution time tracking for incidents rather than all alerts

## Table Cleanup Insights

Table Cleanup Suggestions provide insights for data warehouse optimization.

### Scope
- Focuses on tables with no read activity in the last 30 days
- Identifies potential cleanup candidates for storage optimization

### Field Definitions
- **FULL_TABLE_ID**: Complete table identifier (project.dataset.table)
- **PROJECT_NAME**: External project definition
- **DATASET_NAME**: Schema or dataset name
- **TABLE_NAME**: Individual table identifier
- **TABLE_TYPE**: Classification (table, view, external, wildcard_table)
- **DAYS_SINCE_LAST_WRITE**: Days since last table update
- **LAST_WRITE**: Timestamp of most recent update
- **TOTAL_ROW_COUNT**: Complete row count in table
- **TOTAL_BYTE_COUNT**: Storage size in bytes

## Common Questions

**Q: What types of monitors does Monte Carlo offer?**
A: Monte Carlo offers Data Profiler, JSON Schema Monitor, Comparison Rules, Freshness Monitor (ML), Metric Monitor, Schema Monitor, and Volume Monitor (ML).

**Q: Can monitors be managed programmatically?**
A: Yes, through Monitors as Code functionality using YAML configurations that can be version controlled and deployed automatically.

**Q: Do the ML monitors require manual threshold setting?**
A: No, the Freshness and Volume ML monitors automatically learn normal patterns and detect anomalies without requiring manual threshold configuration.

**Q: How are schema changes handled?**
A: The Schema Monitor automatically detects schema changes, displays them on the assets page, and provides configurable alerting with options for muting and daily digests.

**Q: What training resources are available?**
A: Video tutorials are available for each monitor type, providing step-by-step guidance for implementation and configuration.

**Q: How are tags imported from source systems?**
A: Tags can be imported from Snowflake (requires enablement), BigQuery (automatic), and dbt (from manifest files). Imported tags are clearly marked and sync with source system changes.

**Q: What's the difference between Assets and Catalog?**
A: Assets is the current name for what was formerly called Catalog - it's the same comprehensive data discovery and asset management feature.

**Q: How often do dashboards update?**
A: Most dashboards update in real-time or hourly, but the Data Operations Dashboard updates every 12 hours for long-term trend analysis.

_Last tested: 2025-12-19T17:09:25.654Z_
