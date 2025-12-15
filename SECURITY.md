# Security Policy

## Reporting a Vulnerability

**Do not create a public issue for security vulnerabilities.**

If you discover a security vulnerability in this project, please report it responsibly:

1. **Email:** Contact the maintainers privately at [security contact - update this]
2. **GitHub Security Advisories:** Use [GitHub's private vulnerability reporting](https://github.com/[owner]/[repo]/security/advisories/new) if available

### What to Include

Please provide:
- Clear reproduction steps
- Affected versions or commits
- Impact summary (what an attacker could do)
- Suggested mitigations (if any)

### Response Timeline

- **Acknowledgment:** Within 3 business days
- **Initial assessment:** Within 7 business days
- **Fix timeline:** Depends on severity, but we aim to patch critical issues within 14 days

### Proof-of-Concept Guidelines

- Do not post proof-of-concept code publicly until the issue is resolved
- Use private channels or GitHub Security Advisories for sharing sensitive technical details
- We support coordinated disclosure

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Security Measures in This Project

This application implements several security controls:

### Authentication & Authorization
- NextAuth.js for OAuth authentication
- Session-based authorization on all API routes
- Role-based access control for admin features

### API Security
- Rate limiting on all routes (stricter on LLM endpoints)
- Input validation with Zod schemas
- SSRF protection on URL fetching
- CSRF protection via NextAuth

### Data Protection
- AES-256-GCM encryption for sensitive settings
- No plaintext storage of API keys or secrets
- Audit logging for sensitive operations

### Infrastructure
- Environment variables for all secrets
- Prisma ORM with parameterized queries (SQL injection protection)
- Content Security Policy headers (via Next.js)

## Security Scanning

This repository uses automated security scanning:
- **Dependabot:** Automated dependency updates
- **CodeQL:** Static analysis for JavaScript/TypeScript vulnerabilities
- **Gitleaks:** Secret detection in commits
- **npm audit:** Dependency vulnerability scanning

## Contact

Security issues: [Update with your security contact]
Maintainer: [Update with maintainer contact]
