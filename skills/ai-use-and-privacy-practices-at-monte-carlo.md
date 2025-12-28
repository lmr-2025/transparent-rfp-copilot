---
id: 12738648-151f-4b33-a2e0-39194073a008
title: AI Use and Privacy Practices at Monte Carlo
categories:
  - Security & Compliance
tier: library
created: '2025-12-28T19:50:46.392Z'
updated: '2025-12-28T20:18:40.152Z'
owners:
  - name: lross
    email: lross@montecarlodata.com
    userId: cmjp90c7u0000irtgwtbg4t2p
sources:
  - url: 'https://docs.getmontecarlo.com/docs/external-ai-use-at-monte-carlo.md'
    addedAt: '2025-12-28T19:50:46.364Z'
    lastFetchedAt: '2025-12-28T20:06:02.190Z'
  - url: 'https://docs.getmontecarlo.com/docs/privacy.md'
    addedAt: '2025-12-28T19:50:46.364Z'
    lastFetchedAt: '2025-12-28T20:06:02.190Z'
  - url: 'https://docs.getmontecarlo.com/docs/data-sampling.md'
    addedAt: '2025-12-28T19:50:46.364Z'
    lastFetchedAt: '2025-12-28T20:06:02.190Z'
  - url: 'https://docs.getmontecarlo.com/docs/info-monte-carlo-collects.md'
    addedAt: '2025-12-28T19:50:46.364Z'
    lastFetchedAt: '2025-12-28T20:06:02.190Z'
  - url: 'https://docs.getmontecarlo.com/docs/subprocessors-vendors.md'
    addedAt: '2025-12-28T19:50:46.364Z'
    lastFetchedAt: '2025-12-28T20:06:02.190Z'
active: true
---
## AI Support Systems

### MC Support Assistant
- Provides first-line customer support via Slack
- Trained exclusively on publicly available documentation
- Does not access customer data or internal knowledge
- Operates as a customer-facing support tool

### MC Internal Support Agent
- Completely independent AI system used only by Monte Carlo employees
- Used internally to help debug customer issues
- Trained on public documentation plus internal knowledge
- Has access to information shared by customers through Zendesk tickets created via emails to support@montecarlodata.com
- Does not access or learn from any data within the Monte Carlo platform itself
- Only uses what customers voluntarily share in support tickets (messages, questions, screenshots)

### AI Data Protection Principles
- Customer data is never used to train models for other customers
- Customer data is not shared outside Monte Carlo
- Customer data is not used to train RunLLM more broadly
- Two separate Large Language Models (RunLLM Agents) maintain complete independence

## Privacy Framework and Compliance

### Core Privacy Approach
- Monte Carlo primarily collects metadata, logs, and metrics to reduce data leakage risk
- Focus on identifying data reliability issues rather than accessing sensitive data
- Strong encouragement for customers to mask or anonymize personal data at source before ingestion

### Data Collection and Processing
- Additional features available that require row-level data access
- Row-level data may include personal data depending on the dataset
- Service may ingest personal data through query logs or data sampling search functionality
- Personal data used solely for identifying data reliability issues
- Processing complies with GDPR and EU-U.S. Data Privacy Framework

### Privacy Commitments

#### Transparency
- Clear description of personal information collection practices
- Detailed explanation of data usage and sharing practices
- Information about data collection available in dedicated documentation

#### Purpose Limitation
- Data processed only for specific, defined purposes
- Data retained only as long as necessary for stated purposes
- Data Processing Addendum available at montecarlodata.com/data-processing-addendum/

#### Security
- Technical and organizational measures implemented to safeguard personal data
- Protection against unauthorized access, loss, or misuse
- Detailed security measures documented at montecarlodata.com/technical-and-organizational-security-measures/

### Subprocessors and International Transfers
- Subprocessors with potential to process personal data listed on dedicated page
- International data transfers handled in compliance with EU-U.S. Data Privacy Framework
- GDPR compliance maintained for all personal data processing

### Contact Information
- Privacy questions: privacy@montecarlodata.com
- Support tickets: support@montecarlodata.com
- Full privacy policy available at montecarlodata.com/privacy-policy/

## Data Sampling Features

### Overview
- Data sampling features can temporarily surface rows from warehouses within the UI
- Allows users to query warehouses in ways that can return sensitive business metrics
- Can be disabled at warehouse-level for security, compliance, or regulatory reasons
- Control can be switched by technical members of Monte Carlo account team
- Data from these features sits in Object Storage

### Features Unavailable When Data Sampling is Disabled

#### Within Monitoring
- **SQL Rules:**
  - Value-based SQL rules (returns numeric values vs count-based which obscure information)
  - Parameterized values in SQL rules using {{query_result:field_name}} syntax
  - Test your SQL query functionality showing count of rows or values returned
- **Validation Monitors:**
  - Previewing results of "sets" when using "is in set" or "is not in set" operators
- **Monitoring Agent:**
  - Advanced AI-powered recommendations (heuristic recommendations still available)

#### Within Resolution
- **Root cause analyses:** Follow-up queries that identify traits about erroneous data
- **Troubleshooting agent:** Enhanced functionality using aggregated statistics from sampled data
- **Breached rows from SQL rule breaches:** View specific breached rows in Monte Carlo UI
- **Metric investigation:** View samples of underlying data and segment by fields for anomaly diagnosis

#### Within Assets
- **Data Profiler common values:** Distribution of up to 50 most frequent values for selected fields

## Information Monte Carlo Collects

### Data Types and Storage

#### Metadata
- **Details:** Information about tables, schemas, data freshness and volume, BI reports/dashboards names and attributes
- **Collection:** Via APIs, JDBC connections from warehouses, lakes, and BI tools
- **Purpose:** Build catalog of warehouse, lake and BI objects with schema information
- **Storage:** Cloud service

#### Metrics
- **Details:** Row counts, byte counts, last modification dates, table-level metrics
- **Collection:** Via APIs, JDBC connections from warehouses, lakes, and BI tools
- **Purpose:** Track freshness, volume and data health distribution
- **Storage:** Cloud service

#### Query Logs
- **Details:** Query history, metadata (timestamp, user, errors)
- **Collection:** Via APIs, JDBC connections from warehouses, lakes, and BI tools
- **Purpose:** Track lineage, usage analytics, query history for troubleshooting
- **Storage:** Cloud service

#### Aggregated Statistics
- **Details:** Statistical measures including null rates, distinct values, row counts, percentiles
- **Collection:** Via APIs, JDBC connections from warehouses, lakes, and BI tools
- **Purpose:** Track data health and corruption using ML-based anomaly detection
- **Storage:** Cloud service

#### Application Data
- **Details:** Customer accounts, user settings, configurations, IP addresses, incidents
- **Purpose:** User authentication and service setup
- **Storage:** Cloud service

#### Unstructured Data
- **Details:** Metadata and statistical data from free-text documents, images, emails, logs
- **Purpose:** Monitor sentiment, classification, data consistency in text fields, AI drift and hallucination monitoring
- **Storage:** Cloud service

#### Data Sampling
- **Details:** Sample set of individual values or data records in clear text form associated with data reliability incidents
- **Purpose:** Help users quickly identify nature of data issues and root causes
- **Storage:** Data store

## Subprocessors and Third-Party Vendors

### Overview
- A subprocessor is a third-party data processor engaged by Monte Carlo who has or potentially will have access to and processes customer data as part of the Monte Carlo Platform
- Personal data may be processed by Monte Carlo as part of data sampling for alert investigation
- Only a subset of subprocessors have the potential to process personal data directly through row-level data interaction
- Contact information for personal data subprocessors available in the Monte Carlo Data Processing Addendum
- Customers can subscribe for subprocessor updates at trust.montecarlodata.com

### Personal Data Subprocessors

#### Amazon Web Services (AWS) & Bedrock
- **Role:** Data + AI Observability Platform SaaS Infrastructure and Feature LLM Functionality
- **Products:** Data + AI Observability Platform, LLM Features
- **Personal Data Access:** Yes
- **Compliance:** AWS compliance documentation available

#### Snowflake
- **Role:** Data + AI Observability Platform Warehouse
- **Products:** Data + AI Observability Platform
- **Personal Data Access:** Yes
- **Compliance:** Snowflake security and compliance reports available

#### Databricks
- **Role:** Data + AI Observability Platform Machine Learning
- **Products:** Data + AI Observability Platform
- **Personal Data Access:** Yes
- **Compliance:** Databricks trust and compliance documentation available

#### LangChain (LangSmith)
- **Role:** Observability platform for AI applications
- **Products:** LLM Features
- **Personal Data Access:** Yes
- **Documentation:** LangSmith documentation available

### Non-Personal Data Subprocessors

#### HashiCorp Vault
- **Role:** Backend credential storage
- **Products:** Data + AI Observability Platform
- **Personal Data Access:** No
- **Compliance:** HashiCorp trust and compliance documentation available

#### RunLLM
- **Role:** Support Chat Assistance
- **Products:** LLM Features
- **Personal Data Access:** No
- **Website:** runllm.com

## Common Questions

**Q: Does Monte Carlo use customer data to train AI models for other customers?**
A: No, customer data is never used to train models for other customers and is not shared outside Monte Carlo.

**Q: What data does the customer-facing AI support assistant access?**
A: The MC Support Assistant is trained only on publicly available documentation and does not access customer data.

**Q: How does Monte Carlo handle personal data under GDPR?**
A: Monte Carlo processes personal data in compliance with GDPR and the EU-U.S. Data Privacy Framework, using it solely for identifying data reliability issues.

**Q: What type of data does Monte Carlo primarily collect?**
A: Monte Carlo primarily collects metadata, logs, and metrics rather than sensitive data, to reduce the risk of data leakage.

**Q: Can customers control what data Monte Carlo accesses?**
A: Yes, Monte Carlo strongly encourages customers to mask or anonymize personal data at the source before ingesting it into the platform.

**Q: Can data sampling features be disabled?**
A: Yes, data sampling can be disabled at the warehouse level for security, compliance, or regulatory reasons by a technical member of your Monte Carlo account team.

**Q: What happens when data sampling is disabled?**
A: Certain features become unavailable including value-based SQL rules, root cause analyses, troubleshooting agent enhancements, and data profiler common values, among others.

**Q: Which subprocessors have access to personal data?**
A: AWS/Bedrock, Snowflake, Databricks, and LangChain (LangSmith) are personal data subprocessors. HashiCorp Vault and RunLLM do not process personal data.

**Q: How can I stay updated on subprocessor changes?**
A: You can subscribe for updates at Monte Carlo's Trust Center (trust.montecarlodata.com).
