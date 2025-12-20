---
id: edb48f15-0595-4b7e-a259-b3163b42de42
title: Monte Carlo Chargebacks and Resource Consumption Attribution
categories:
  - Pricing & Plans
created: '2025-12-20T21:13:52.978Z'
updated: '2025-12-20T21:13:52.986Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/consumption-of-mc-credits.md'
    addedAt: '2025-12-20T21:13:52.946Z'
    lastFetchedAt: '2025-12-20T21:13:52.946Z'
  - url: 'https://docs.getmontecarlo.com/docs/consumption-of-warehouse-resources.md'
    addedAt: '2025-12-20T21:13:52.946Z'
    lastFetchedAt: '2025-12-20T21:13:52.946Z'
  - url: 'https://docs.getmontecarlo.com/docs/chargebacks.md'
    addedAt: '2025-12-20T21:13:52.946Z'
    lastFetchedAt: '2025-12-20T21:13:52.946Z'
active: true
---
## Overview

Monte Carlo provides comprehensive chargeback capabilities for enterprises that need to attribute costs back to their lines of business. There are two main types of consumption to track:

- **Warehouse resource consumption**: Queries and jobs run by Monte Carlo monitors in your data warehouse (Snowflake, BigQuery, etc.)
- **Monte Carlo credit consumption**: For customers on consumption pricing plans

## Monte Carlo Credit Consumption

### Data Exports for Credit Attribution

For customers on consumption pricing plans, credit attribution is managed using Data Exports, available through:
- UI interface
- API/CLI
- Snowflake data shares

### Consumption Data Export

The **Consumption** data export provides:
- Granular consumption of credits by monitor
- Data for the last 30 days
- Ability to join with Monitors data export using `MONITOR_ID`

### Monitors Data Export Integration

The **Monitors** data export contains detailed metadata about each monitor:
- Monitor creators (`created_by`)
- Domains
- Audiences
- Monitor tags
- Other attribution metadata
- Retains deleted monitors for 30 days

### Access Methods

- **UI Access**: Download from Settings > Billing page (top-right corner) for Consumption export
- **Monitors Export**: Available from Monitors page with similar placement

### Availability Requirements

The Consumption data export is only available to customers who meet BOTH conditions:
- Are on a consumption pricing plan
- Are on the new version of Table Monitors (accounts created after July 2, 2025, or have "Table" as an available monitor type in the Monitor Menu)

### Fractional Credit Allocation

When a table is included in multiple Table Monitors:
- Cost is distributed evenly across all Table Monitors that include it
- Example: Table in 3 different monitors = one-third of credits attributed to each monitor
- This fractional attribution ensures accurate chargeback to respective lines of business
- Important because Table Monitors often include many tables and account monitors often overlap

## Warehouse Resource Consumption

### Attribution Methods

Two primary options for attributing warehouse resource consumption:

1. **Query Tags**: Queries include monitor identification tags
2. **Connections**: Multiple connections for distinct user/warehouse tracking

### Query Tags Implementation

#### Supported Platforms
- **Snowflake**: QUERY_TAG text includes `mc_monitor_id=<uuid>`
- **BigQuery**: Job labels include `mc_monitor_id=<uuid>`

#### Usage Capabilities
- Map queries/jobs to specific `monitor_id`
- Join to Monitors Data Export for detailed attributes
- Group by attributes to attribute warehouse usage/cost per team

#### Snowflake Query Tag Example

```sql
select
  m.audiences as audiences,
  count(*) as query_count,
  sum(q.execution_time) as execution_ms
from snowflake.account_usage.query_history q
join <your_share_schema>.monitors m
  on m.monitor_id = regexp_substr(q.query_tag, 'mc_monitor_id=([0-9a-f\-]{36})', 1, 1, 'i', 1)
where q.query_tag ilike '%mc_monitor_id=%'
  and q.start_time >= dateadd('day', -7, current_timestamp())
group by audiences
order by execution_ms desc
```

#### BigQuery Query Tag Example

```sql
select
  m.audiences as audiences,
  count(*) as job_count,
  sum(j.total_bytes_billed) as total_bytes_billed
from `region-<YOUR_REGION>`.INFORMATION_SCHEMA.JOBS_BY_PROJECT j
cross join unnest(j.labels) l
join `<your_dataset>`.monitors m
  on m.monitor_id = l.value
where l.key = 'mc_monitor_id'
  and j.creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
group by audiences
order by job_count desc
```

**Note**: Replace `region-<YOUR_REGION>` with your BigQuery region (e.g., `region-us`)

### Connections-Based Attribution

#### Supported Data Sources
- Snowflake
- BigQuery
- Redshift
- Databricks

#### Implementation
- Administrators create multiple connections
- Associate connections with distinct users or warehouses
- Track consumption by connection
- Use Authorization Groups to limit connection access per user

#### Authorization Groups Integration
- Administrators define which connections are available to users in specific Authorization Groups
- When users create monitors or use Data Profiler, only permissible connections are available
- Ensures team consumption can be easily tracked

#### Enterprise Tier Limitation
- Connection-based attribution with Authorization Groups is limited to Enterprise product tier customers

### Table Monitors Metadata Collection Limitation

Metadata for Table Monitors is collected en masse through the connection specified for metadata collection. There is no ability to select between connections for Table Monitors.

## Common Questions

**Q: What data exports are available for chargeback attribution?**
A: Consumption data export (for Monte Carlo credits) and Monitors data export (for detailed monitor metadata), available via UI, API/CLI, or Snowflake data shares.

**Q: How are credits allocated when a table is in multiple monitors?**
A: Credits are distributed evenly across all Table Monitors that include the table (fractional allocation).

**Q: Which warehouses support query tags for resource attribution?**
A: Snowflake (using QUERY_TAG) and BigQuery (using job labels) currently support query tags with monitor IDs.

**Q: What are the requirements for accessing Consumption data exports?**
A: Must be on a consumption pricing plan AND on the new version of Table Monitors (accounts created after July 2, 2025 or with Table monitor type available).

**Q: Are there any Enterprise-only chargeback features?**
A: Yes, associating Connections with Authorization Groups for connection-based attribution is limited to Enterprise product tier customers.
