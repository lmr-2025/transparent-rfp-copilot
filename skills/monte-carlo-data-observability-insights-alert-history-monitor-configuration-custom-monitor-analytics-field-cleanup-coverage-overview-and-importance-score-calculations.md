---
id: ea4b8e13-76c4-429d-91fe-41dadf3d1eab
title: >-
  Monte Carlo Data Observability Insights: Alert History, Monitor Configuration,
  Custom Monitor Analytics, Field Cleanup, Coverage Overview, and Importance
  Score Calculations
categories:
  - Product & Features
tier: library
created: '2025-12-29T20:01:00.490Z'
updated: '2025-12-29T20:01:00.502Z'
owners:
  - name: lross
    email: lross@montecarlodata.com
    userId: cmjp90c7u0000irtgwtbg4t2p
sources:
  - url: 'https://docs.getmontecarlo.com/docs/insight-incident-history.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: 'https://docs.getmontecarlo.com/docs/insight-misconfigured-monitors.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: >-
      https://docs.getmontecarlo.com/docs/insight-notification-by-custom-monitor.md
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: 'https://docs.getmontecarlo.com/docs/insight-rule-and-sli-results.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: 'https://docs.getmontecarlo.com/docs/insight.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: 'https://docs.getmontecarlo.com/docs/key-assets-1.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
  - url: 'https://docs.getmontecarlo.com/docs/key-assets-importance-score.md'
    addedAt: '2025-12-29T20:01:00.458Z'
    lastFetchedAt: '2025-12-29T20:01:00.458Z'
active: true
---
## Alert History Insight

Monte Carlo's Alert History insight provides comprehensive tracking and analysis of data incidents with a 1-year lookback window. This insight replaces the deprecated Incident History feature and offers detailed incident tracking capabilities.

### Alert Identification and Classification
- **ALERT_ID**: Unique identifier assigned to each incident for tracking purposes
- **ALERT_TYPE**: Categorizes incidents into specific types including:
  - Anomalies
  - Custom rule anomalies
  - Metric anomalies
  - Schema changes
- **PROJECT_NAME**: External project definition as configured in your data infrastructure
- **DATASET_NAME**: External dataset definition (e.g., schema in Snowflake)

### Incident Timing and Lifecycle
- **INCIDENT_CREATED_DATE**: Date when the incident was first created
- **INCIDENT_CREATED_TIMESTAMP**: Precise timestamp of incident creation
- **FIRST_FEEDBACK**: Initial status assigned to the incident
- **FIRST_FEEDBACK_TIMESTAMP**: Timestamp of the first feedback entry
- **LAST_FEEDBACK**: Most recent status update for the incident
- **LAST_FEEDBACK_DATE**: Date of the most recent feedback
- **LAST_FEEDBACK_TIMESTAMP**: Precise timestamp of the last feedback

### Impact Assessment Metrics
- **N_EVENTS**: Count of unique events associated with the incident
- **N_TABLES**: Count of unique tables affected by the incident
- **N_KEY_ASSETS**: Count of unique 'important' tables impacted
- **MAX_IMPORTANCE_SCORE**: Highest importance score within the incident
- **AVG_IMPORTANCE_SCORE**: Average importance score across all affected assets
- **KEY_ASSETS_WITH_IMPORTANCE_SCORE**: List of important tables with their corresponding importance scores
- **NON_KEY_ASSETS_WITH_IMPORTANCE_SCORE**: List of non-important tables with their importance scores

### Incident Management and Organization
- **OWNER**: Incident owner as defined in the Monte Carlo UI
- **SEVERITY**: Severity level as configured in the UI
- **PRIORITY**: Priority level as set in the UI
- **DOMAINS**: User-created domains for organizational purposes
- **INCIDENT_APP_URL**: Direct link to the incident within the Monte Carlo application

### Notification and Communication
- **SENT_VIA**: List of notification sources used (e.g., Slack, Microsoft Teams)
- **SENT_VIA_CHANNEL**: List of specific notification recipients or channels

## Misconfigured Monitors Insight

The Misconfigured Monitors insight identifies monitors that may need attention, reconfiguration, or removal to optimize your data observability setup.

### Table and Asset Identification
- **FULL_TABLE_ID**: Complete table identifier combining project, dataset, and table name
- **PROJECT_NAME**: External project definition
- **DATASET_NAME**: External dataset definition (e.g., schema in Snowflake)
- **TABLE_NAME**: External table definition
- **TABLE_TYPE**: Asset type classification with values:
  - Table
  - View
  - External
  - Wildcard_table

### Monitor Configuration Details
- **MONITOR_UUID**: Unique identifier for each monitor
- **MONITOR_TYPE**: Monitor category (field health/dimension tracking)
- **AGG_TYPE**: Aggregation frequency (daily/hourly)
- **MONITOR_STATUS**: Current operational status of the monitor
- **CREATED_ON**: Timestamp indicating when the monitor was originally created
- **LAST_MODIFIED_BY**: User who made the most recent changes to the monitor
- **MONITOR_URL**: Direct link to the monitor within the Monte Carlo application

### Optimization Recommendations
- **SUGGESTION**: Monte Carlo's automated recommendation for monitor reconfiguration or deletion
- **DOMAINS**: User-created organizational domains

### Report Exclusions
Monitors with the following statuses are automatically excluded from the Misconfigured Monitor report:
- Effective Monitor
- Warming Up
- Monitor is Paused
- No Data

## Notifications by Custom Monitor Insight

This insight provides weekly notification counts separated by the distinct custom monitors that generated them, enabling analysis of notification patterns and monitor effectiveness.

### Monitor Identification and Configuration
- **MONITOR_URL**: Direct link to the monitor detail page in Monte Carlo
- **MONITOR_TYPE**: The type of monitor (e.g., Field Health, Custom SQL)
- **MONITOR_NAME**: The name of the monitor as defined in the monitor detail page by the user
- **MONITOR_CREATED_BY**: The user who created the monitor
- **MONITOR_CREATED_ON**: The date that the monitor was created on
- **MONITOR_LABELS**: The audiences that have been applied to this monitor (labels are equivalent to audiences)

### Notification Tracking
- **NOTIFICATION_SENT_WEEK**: The first day of the week on which the notification was sent
- **COUNT_NOTIFICATIONS**: A count of the notifications that were sent due to an incident occurring on the monitor listed during that specific week

## Rule Results Insight

The Rule Results insight provides detailed information about custom rule executions and their outcomes, including both custom rules and SLI (Service Level Indicator) results.

### Rule Configuration and Identification
- **RULE_DESCRIPTION**: As defined by the user in the UI or via Monitors as Code
- **RULE_UUID**: Unique identifier for the custom rule
- **GENERATED_BY_RULE_UUID**: Unique identifier of the parent custom rule if variables were used, otherwise identical to RULE_UUID
- **MONITOR_TYPE**: The monitor type
- **LABELS**: Labels (audiences) associated with the rule
- **TABLES**: Comma-delimited list of tables associated with the rule

### Execution Results and Performance
- **RUNNING_TIME**: A timestamp that the monitor ran
- **QUERY_VALUE**: Null for SLI, 0 when custom rule has passed, number of records returned otherwise
- **THRESHOLD**: Threshold used for breach evaluation, if appropriate
- **PASS_OR_BREACH**: A pass/breach boolean

## Field-level Cleanup Suggestions Insight

The Field-level Cleanup Suggestions insight identifies fields that can be safely removed from tables to optimize data storage and maintenance. Monte Carlo suggests deleting fields that are not used in downstream tables, BI reports, or SELECT queries, and where the table itself is not eligible for cleanup.

### Table and Asset Identification
- **FULL_TABLE_ID**: Complete table identifier combining project, dataset, and table name
- **PROJECT_NAME**: External project definition
- **DATASET_NAME**: External dataset definition (e.g., schema in Snowflake)
- **TABLE_NAME**: External table definition
- **TABLE_TYPE**: Asset type classification with values:
  - Table
  - View
  - External
  - Wildcard_table

### Field Analysis and Recommendations
- **FIELD_TO_CLEANUP**: List of fields that can be safely removed
- **FIELD_TO_KEEP**: List of fields that should be retained
- **PERCENT_REMOVABLE**: Percentage of fields in the table that can be deleted (insight is sorted by this metric)
- **TABLE_IMPORTANCE_SCORE**: The table importance score (insight is sorted by this metric)

## Coverage Overview Insight

The Coverage Overview insight provides a comprehensive view of monitoring coverage across your data assets, showing which types of monitors are active for each table.

### Table and Asset Identification
- **FULL_TABLE_ID**: Complete table identifier combining project, dataset, and table name
- **PROJECT_NAME**: External project definition
- **DATASET_NAME**: External dataset definition (e.g., schema in Snowflake)
- **TABLE_NAME**: External table definition
- **TABLE_TYPE**: Asset type classification with values:
  - Table
  - View
  - External
  - Wildcard_table

### Monitor Coverage Status
- **SCHEMA_MONITOR**: True where this monitor exists (regardless of its status), False otherwise
- **FRESHNESS_MONITOR**: True where the freshness detector is active, False otherwise
- **SIZE_MONITOR**: True where size data is collected for the table, False otherwise
- **VOLUME_MONITOR**: True where volume detector is active, False otherwise
- **UNCHANGED_SIZE_MONITOR**: True where unchanged size detector is active, False otherwise
- **FIELD_HEALTH_MONITOR**: True where this monitor exists (regardless of its status), False otherwise
- **DISTRIBUTION_MONITOR**: True where this monitor exists (regardless of its status), False otherwise
- **JSON_SCHEMA_MONITOR**: True where this monitor exists (regardless of its status), False otherwise

### Configuration and Organization
- **MUTED**: True where the table is muted, False otherwise
- **DOMAINS**: User-created domains for organizational purposes

## Importance Score Calculations

Monte Carlo calculates importance scores for different asset types to help prioritize monitoring and maintenance efforts. These scores range from 0 to 1 and determine which assets are considered "key assets" or "important."

### Table Importance Score Calculation

Table importance scores are based on five key parameters:
- **Number of reads**: Query frequency over the last 30 days
- **Number of users**: Count of distinct query executors
- **Degree of connectivity**: Number of parent and child table relationships
- **Update periodicity**: Whether the table is updated on a regular schedule
- **Age & freshness**: How current and established the table is

#### Scoring Prerequisites
- Tables must be specified in the warehouse metadata
- Must have at least one read or write query in the last 30 days
- Tables not queried in 30 days appear in "Cleanup Suggestions" insight
- Score is set to zero for stale, newly created, or rarely used tables

#### Scoring Groups
Tables are divided into three scoring groups for independent evaluation:
- **Source tables**: Tables with no parent tables
- **ETL tables**: Tables with both parent and child tables
- **Analytic tables**: Tables with parents but no children, queried by users/BI tools

#### Detailed Scoring Logic
1. **Automatic zero scoring**: Applied if table was not queried in last 14 days or queried for less than 3 distinct days out of last 30 days
2. **Parameter scoring**:
   - **Reads score**: Zero if avg. reads < 1, otherwise percentile transformation (0-1)
   - **Users score**: Zero if query executors < 3, otherwise percentile transformation (0-1)
   - **Degree score**: Zero if table degree < 3, otherwise set to 0.5
   - **Periodicity score**: 1.2 for periodic tables, 0 otherwise (views inherit from connected periodic tables)
3. **Final calculation**: importance_score = w(periodicity score) + (1-w)(group score)
4. **Key asset threshold**: Tables with score ≥ 0.6 are considered important

### Field Importance Score Calculation

Field importance scores are based on usage patterns over the last 7 days, summed across up to 4 downstream layers:
- **Explicit reads**: Direct field selection in transformation queries
- **Implicit reads**: SELECT * queries in transformation queries
- **Ad-hoc queries**: User queries using the field (explicit or implicit)
- **Dashboard usage**: Number of dashboards using the field

#### Scoring Formula
Preliminary score = 10 × num_dashboards + 5 × num_explicit_reads + 2 × num_implicit_reads + log2(num_adhoc_queries)

#### Score Normalization
1. **Global importance score**: Min-max scaling across entire warehouse (0-1)
2. **Local importance score**: Min-max scaling within each table (0-1)
3. **Key field criteria**: Global score ≥ 0.5 OR local score ≥ 0.8
4. **Cleanup eligibility**: Fields with zero usage in last week across all categories

### Looker Dashboard Importance Score

Dashboard scores are calculated using weighted parameters:
- **Recent usage count**: Number of recent dashboard views
- **Days since last used**: Recency of dashboard access
- **Days since created**: Dashboard age and establishment

**Key dashboard threshold**: Score ≥ 0.8 considered important/key assets

### Databricks Importance Score

#### With Query Logs (Unity Catalog Required)
Same calculation methodology as other warehouses using the standard table scoring parameters.

#### Without Query Logs
Simplified scoring based solely on:
- **Freshness events**: Count of freshness events in last 30 days
- **Scoring logic**: 
  - Score = 0.9 (key asset) if > 5 freshness events in 30 days
  - Score = 0.0 otherwise

## Common Questions

**Q: How far back does the Alert History insight look?**
A: The Alert History insight has a 1-year lookback window for all included data.

**Q: What types of alerts are tracked in the Alert History?**
A: Alert types include anomalies, custom rule anomalies, metric anomalies, and schema changes.

**Q: Which monitors are excluded from the Misconfigured Monitors report?**
A: Monitors with statuses of 'Effective Monitor', 'Warming Up', 'Monitor is Paused', or 'No Data' are excluded.

**Q: What aggregation types are available for monitors?**
A: Monitors can be configured for daily or hourly aggregation.

**Q: How are importance scores calculated for incidents?**
A: The system tracks both maximum and average importance scores, with separate listings for key assets and non-key assets along with their respective scores.

**Q: What's the difference between labels and audiences in Monte Carlo?**
A: Labels and audiences are equivalent terms in Monte Carlo - they represent the same concept for organizing and targeting monitors.

**Q: How does the Rule Results insight handle different types of rules?**
A: For SLI rules, the QUERY_VALUE is null. For custom rules, it returns 0 when the rule passes or the number of records returned when it breaches.

**Q: What time period does the Notifications by Custom Monitor insight cover?**
A: This insight tracks notifications on a weekly basis, with NOTIFICATION_SENT_WEEK representing the first day of each week.

**Q: What criteria does Monte Carlo use to suggest field cleanup?**
A: Monte Carlo suggests deleting fields that are not used in downstream tables, BI reports, or SELECT queries, and where the table itself is not eligible for cleanup.

**Q: How is the Coverage Overview insight organized?**
A: The Coverage Overview shows boolean values (True/False) for each type of monitor, indicating whether that monitoring capability is active for each table.

**Q: What does the PERCENT_REMOVABLE field indicate in the Field-level Cleanup insight?**
A: It shows the percentage of fields in a table that can be safely deleted, and the insight is sorted by this metric to prioritize cleanup opportunities.

**Q: What makes a table or field "important" in Monte Carlo?**
A: Tables are considered important with an importance score ≥ 0.6. Fields are important if their global score ≥ 0.5 or local score ≥ 0.8. Looker dashboards are important with scores ≥ 0.8.

**Q: How does Monte Carlo handle importance scoring for Databricks without Unity Catalog?**
A: Without query logs, Databricks assets receive a score of 0.9 (key asset) if they have more than 5 freshness events in 30 days, otherwise 0.0.

**Q: What time periods are used for importance score calculations?**
A: Table scores use 30-day lookbacks for most parameters (14 days minimum for recent queries), while field scores use 7-day lookbacks with up to 4 downstream layers.

**Q: How does Monte Carlo categorize tables for importance scoring?**
A: Tables are grouped into source tables (no parents), ETL tables (both parents and children), and analytic tables (parents but no children, queried by users/BI tools).
