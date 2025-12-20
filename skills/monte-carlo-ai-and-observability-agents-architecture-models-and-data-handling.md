---
id: 91ffe7bb-d515-461a-abda-412b77e68f8d
title: >-
  Monte Carlo AI and Observability Agents - Architecture, Models, and Data
  Handling
categories:
  - Product & Features
created: '2025-12-19T20:35:53.067Z'
updated: '2025-12-19T20:35:53.076Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/ai-architecture-data-handling.md'
    addedAt: '2025-12-19T20:35:53.037Z'
    lastFetchedAt: '2025-12-19T20:35:53.037Z'
  - url: 'https://docs.getmontecarlo.com/docs/ai-technical-specs.md'
    addedAt: '2025-12-19T20:35:53.037Z'
    lastFetchedAt: '2025-12-19T20:35:53.037Z'
  - url: 'https://docs.getmontecarlo.com/docs/ai-features-and-technical-info.md'
    addedAt: '2025-12-19T20:35:53.037Z'
    lastFetchedAt: '2025-12-19T20:35:53.037Z'
  - url: >-
      https://docs.getmontecarlo.com/docs/monte-carlo-mcp-server-technical-overview.md
    addedAt: '2025-12-19T20:35:53.037Z'
    lastFetchedAt: '2025-12-19T20:35:53.037Z'
  - url: 'https://docs.getmontecarlo.com/docs/external-ai-use-at-monte-carlo.md'
    addedAt: '2025-12-19T20:35:53.037Z'
    lastFetchedAt: '2025-12-19T20:35:53.037Z'
active: true
---
## Overview

Monte Carlo offers Large Language Model (LLM) powered features called **Observability Agents** that enhance data quality operations across your data stack. These AI features work on top of the observability data Monte Carlo already collects, using a feature-by-feature approach to data handling where each agent is designed with intentional data handling based on what it needs to deliver value while protecting customer data.

## AI Models and Infrastructure

### Large Language Models
* **Primary Models**: Anthropic's Claude models accessed via Amazon Web Services (AWS) Bedrock
* **Data Protection**: Customer data is never used for model improvement
* **Processing**: No persistent storage in AWS Bedrock - data is processed transiently only

### Model Availability by Region
* **US Region**: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Haiku 3.5
* **EU Region**: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Haiku 3
* **APAC Region**: Claude Haiku 4.5, Claude Sonnet 3.7, Claude Haiku 3
* **Model Updates**: Versions may be updated as newer Claude models become available in Bedrock

## Data Handling Architecture

### Feature-by-Feature Data Approach
Each Observability Agent uses the minimum data types necessary:
* **Metadata only**: Some agents only need schema, table names, query patterns, and lineage - no data values required
* **Aggregated information**: Some agents work with statistics (row counts, null percentages, distributions) rather than individual records
* **Sample data**: Some agents require seeing actual data values to detect patterns, understand formats, or identify quality issues

### Data Flow Process
1. **Context Preparation**: Monte Carlo gathers specific data needed (metadata, aggregated statistics, or samples) from internal systems and object storage
2. **Prompt Construction**: Builds prompts with feature-specific instructions, prepared data, and conversation history if applicable
3. **LLM Processing**: Sent to AWS Bedrock (Anthropic Claude models) for analysis and recommendations
4. **Data Safeguards**: Samples sent to LLM are immediately discarded after processing and excluded from traces; only aggregates or metadata in prompts get full trace logging
5. **Response Delivery**: AI-generated insights returned in the Monte Carlo UI
6. **Conversation Memory**: Context maintained up to 30 days in Monte Carlo's AWS environment for follow-up questions

## Data Storage and Retention

| Data Type | Storage Location | Duration | Purpose |
|-----------|------------------|----------|----------|
| Metadata (schemas, table names) | Monte Carlo platform | Persistent | Core observability, AI analysis |
| Query logs | Monte Carlo platform | Persistent | Lineage, usage analytics, AI context |
| Data samples | Object storage | Configurable | Data quality monitoring, AI features |
| AI conversation history | Monte Carlo AWS environment | Up to 30 days | Conversational features |
| LLM processing | AWS Bedrock | Transient only | Real-time AI inference |

## AI Capabilities

### Intelligent Monitoring Recommendations
* Analyzes data warehouse metadata, query patterns, and sample data
* Recommends custom monitors to improve coverage and catch issues earlier
* Uses existing observability data without new data collection

### Automated Root Cause Analysis
* Investigates potential causes when alerts are triggered
* Analyzes data changes, system failures, code updates, and lineage
* Surfaces most likely root causes to accelerate time-to-resolution

### Conversational Interaction
* Natural language interaction with Observability Agents
* Context-aware responses as investigations progress
* Follow-up questions and iterative refinement capabilities

### Supported Use Cases
* **Data quality monitoring**: Recommending monitors, detecting anomalies, assessing coverage gaps
* **Incident investigation**: Root cause analysis, hypothesis testing, correlating changes
* **Query assistance**: SQL generation, query explanation, optimization suggestions
* **Conversational troubleshooting**: Follow-up questions, iterative refinement, context retention

## System Requirements

### Optimal Requirements for Best Performance
* **Data sampling enabled**: Required for some features, enhances others
* **Query logs enabled**: Provides usage patterns and lineage data for AI analysis
* **Full lineage instrumentation**: Connections to upstream/downstream systems
* **Active integrations**: GitHub/GitLab, dbt, Airflow, or other orchestration tools
* **Historical data**: At least 7-14 days of monitoring data for pattern recognition

### Features Requiring Data Sampling
* Monitoring recommendations that analyze field values
* Data pattern detection and anomaly identification
* Features that assess data quality at the record level
* When data sampling is disabled, these features become unavailable while metadata-only features continue working

## Monte Carlo MCP Server

### Architecture Components
* **MCP Clients**: AI tools that initiate requests through the MCP protocol
* **Integration Gateway**: Authenticates requests, validates tokens, and forwards traffic to the MCP Server
* **MCP Server**: Hosted in AWS Lambda, exposes Monte Carlo's capabilities such as alerting and lineage
* **GraphQL API**: Monte Carlo's backend service for executing and authorizing data queries

### Security and Authentication
* **API Keys**: Customers authenticate using standard Monte Carlo credentials
* **No Token Pass-through**: MCP Server never directly reuses customer tokens
* **Identity Preservation**: API calls executed under user's identity in Monte Carlo's GraphQL API
* **Access Controls**: Existing Monte Carlo access controls are preserved

### Data Access and Privacy
* **Customer Isolation**: All API calls scoped to authenticated user's tenant and data region
* **Encryption in Transit**: All communications use HTTPS (TLS 1.2+)
* **Stateless Design**: No persistence or caching of customer data - real-time processing only
* **Auditing**: Requests include telemetry metadata for full traceability and compliance review

## Customer Support AI Use

### MC Support Assistant
* Provides first line support to customers via Slack
* Trained only on publicly available documentation
* Customer data never used to train models for other customers

### MC Internal Support Agent
* Used internally by Monte Carlo employees for debugging
* Trained on public documentation plus internal knowledge
* Includes information from customer Zendesk tickets sent to support@montecarlodata.com
* Does not access data within Monte Carlo platform itself
* Only uses what customers share in Zendesk tickets (messages, questions, screenshots)

## Feature Control

### Enabling and Disabling
* All Observability Agent features enabled by default for all Monte Carlo customers
* Customers have control to disable specific or all Observability Agents
* When data sampling is disabled, sample-dependent features become unavailable while metadata-only features continue working

### Data Collection
* **No new data collection**: Uses existing observability data from connected warehouses and tools
* **Customer control**: Features available out-of-the-box with option to disable
* **Warehouse credentials**: Stored encrypted in Monte Carlo

## Common Questions

**Q: What AI models does Monte Carlo use?**
A: Anthropic's Claude models (Sonnet 4.5, Haiku 4.5, Haiku 3.5, Sonnet 3.7, Haiku 3) accessed via AWS Bedrock, with availability varying by region.

**Q: Is customer data used to train AI models?**
A: No, customer data is never used for model improvement and is processed transiently only in AWS Bedrock.

**Q: Do Observability Agents require new data collection?**
A: No, they work on top of observability data Monte Carlo already collects for core monitoring.

**Q: How long is AI conversation history retained?**
A: Up to 30 days in Monte Carlo's AWS environment for conversational features.

**Q: Can Observability Agents be disabled?**
A: Yes, customers have control to disable specific or all Observability Agent features.
