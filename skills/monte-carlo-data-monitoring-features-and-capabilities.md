---
id: 2dd934b6-cf4b-44e6-8527-efe8eaf42ae3
title: Monte Carlo Data Monitoring Features and Capabilities
categories:
  - Product & Features
created: '2025-12-19T16:47:43.525Z'
updated: '2025-12-19T17:09:25.667Z'
owners:
  - name: Test User
    email: test@example.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/data-profiler.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/json-schema-monitor.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-comparison-rules.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
  - url: 'https://docs.getmontecarlo.com/docs/mcu-freshness.md'
    addedAt: '2025-12-19T16:47:43.497Z'
    lastFetchedAt: '2025-12-19T16:47:43.497Z'
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

_Last tested: 2025-12-19T17:09:25.654Z_
