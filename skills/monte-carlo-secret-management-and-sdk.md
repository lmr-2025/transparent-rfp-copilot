---
id: db1db452-8ec9-43ba-abaa-d5a126cf3a8c
title: Monte Carlo Secret Management and SDK
categories:
  - Integrations
created: '2025-12-19T19:07:20.737Z'
updated: '2025-12-19T19:07:20.746Z'
owners:
  - name: lross
    email: lross@monteccarlodata.com
    userId: cmjd3p1oq0000iruzymyw2ji7
sources:
  - url: 'https://docs.getmontecarlo.com/docs/secret-management-with-the-cli.md'
    addedAt: '2025-12-19T19:07:20.698Z'
    lastFetchedAt: '2025-12-19T19:07:20.698Z'
  - url: 'https://docs.getmontecarlo.com/docs/using-the-sdk.md'
    addedAt: '2025-12-19T19:07:20.698Z'
    lastFetchedAt: '2025-12-19T19:07:20.698Z'
active: true
---
## Secret Management with CLI

### Overview
Monte Carlo provides secret management capabilities through the CLI to avoid storing sensitive information like API tokens in plain text within code repositories. This is particularly important when using Monitors as Code. Secrets are account-specific and can be referenced in specific parts of the product instead of using plain text strings.

### Creating Secrets
Create secrets using the `montecarlo secrets create` command:
```
montecarlo secrets create --name my_new_secret --scope <a secret scope>
```

**Parameters:**
- `name`: Identifies the secret, can only include `a-z`, `A-Z`, `0-9`, `_`, or `-` characters, up to 64 characters in length
- `scope`: Defines context of use for the secret
  - `notifications`: Only usable in notification settings context
  - `global`: Available in all contexts
- `description`: (Optional) Description for the secret
- `expires-at`: (Optional) Date when the secret becomes unavailable for use

The secret value is entered via prompt and is never displayed except when using the `secrets get` command with appropriate permissions.

### Reading Secrets
Retrieve secret details using the `secrets get` command:
```
montecarlo secrets get --name my_new_secret [--reveal]
```

**Parameters:**
- `name`: The secret name
- `reveal`: If provided, only the secret value will be returned

**Access Control:**
Secret values can only be read by:
- Account Owners
- The user who created the secret

### Additional Commands
Use `montecarlo secrets --help` to list other available secret management commands.

### Referencing Secrets
Secrets can be referenced in specific configuration options using the format: `{secret:<secret name>}`

**YAML Usage:**
In YAML files, the reference must be enclosed in quotes to prevent YAML interpretation:
```yaml
api_key: "{secret:<your secret name>}"
```

**Important:** The secret name is extracted from between `secret:` and the last `}`, so avoid trailing or leading whitespaces.

### Supported Configuration Options
Currently supported options for secret references:

| Option | Scopes (in addition to global) | Usage Context |
|--------|--------------------------------|---------------|
| PagerDuty `routing_key` | `notifications` | Notifications as Code |
| Opsgenie `api_key` | `notifications` | Notifications as Code |
| Webhook `secret` | `notifications` | Notifications as Code |

## SDK Access

### Overview
Monte Carlo provides programmatic access to all APIs and additional features through a Software Development Kit (SDK).

### Requirements
- API key is required to use the SDK
- API keys can be obtained through the Getting Started developer resources

### Available Languages
**Python SDK:**
- Package: pycarlo
- Repository: https://pypi.org/project/pycarlo/
- Provides convenient access to all Monte Carlo APIs and additional features

## Common Questions

**Q: How do I securely store API tokens when using Monitors as Code?**
A: Use Monte Carlo's secret management feature with the CLI to create secrets that can be referenced instead of storing plain text tokens in code repositories.

**Q: Who can access secret values?**
A: Only Account Owners or the user who created the secret can read secret values.

**Q: What programming languages are supported for the SDK?**
A: Currently Python is supported through the pycarlo package available on PyPI.

**Q: How do I reference a secret in YAML configuration?**
A: Use the format `"{secret:<secret_name>}"` with quotes to prevent YAML interpretation issues.

**Q: What scopes are available for secrets?**
A: Two main scopes: `notifications` (limited to notification settings) and `global` (available in all contexts).
