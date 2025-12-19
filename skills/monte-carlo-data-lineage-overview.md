---
id: 8916a2ab-848a-4f41-9527-e2534cde2c8f
title: Monte Carlo Data Lineage Overview
categories:
  - Product & Features
created: '2025-12-19T16:47:44.091Z'
updated: '2025-12-19T17:20:00.000Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/mcu-lineage.md'
    addedAt: '2025-12-19T16:47:44.065Z'
    lastFetchedAt: '2025-12-19T16:47:44.065Z'
active: true
---
## Introduction to Lineage

Monte Carlo provides comprehensive data lineage capabilities that help organizations understand data flow and dependencies across their data infrastructure.

## Lineage Types

### Table-Level Lineage
- Tracks relationships and dependencies between tables
- Shows how data flows from source tables to downstream tables
- Provides visibility into table-to-table connections

### Field-Level Lineage
- Granular tracking at the individual field/column level
- Maps how specific fields transform and move through the data pipeline
- Enables precise impact analysis for field-level changes
- Additional documentation available at: https://docs.getmontecarlo.com/docs/field-lineage

## Lineage Filtering

### Regex-Based Filtering
- Supports regular expression patterns to filter lineage views
- Allows users to focus on specific data assets or patterns
- Helps manage complex lineage graphs by excluding irrelevant connections
- Enables customized lineage visualization based on naming conventions or data patterns

## Use Cases

- **Impact Analysis**: Understand downstream effects of data changes
- **Data Discovery**: Trace data origins and transformations
- **Compliance**: Document data flow for regulatory requirements
- **Troubleshooting**: Identify root causes of data quality issues
- **Documentation**: Maintain up-to-date data flow documentation

## Common Questions

**Q: Does Monte Carlo support field-level lineage?**
A: Yes, Monte Carlo provides both table-level and field-level lineage tracking.

**Q: Can I filter lineage views?**
A: Yes, you can use regex patterns to filter and customize lineage displays.

**Q: What types of lineage does Monte Carlo track?**
A: Monte Carlo tracks both table-level lineage (table-to-table relationships) and field-level lineage (column-to-column mappings).

---

_Test edit #1: Made directly to markdown file at 2025-12-19T17:15:00Z to test git→database sync._
_Test edit #2: Made at 2025-12-19T17:20:00Z to test sync logging._
