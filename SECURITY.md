# Security Policy

## Supported Versions

The latest version of PaySphere is actively maintained and receives security updates.

| Version | Supported |
|---------|-----------|
| Latest | ✅ Yes |
| Older versions | ❌ No |

---

## Reporting a Vulnerability

The security of PaySphere is important to us. If you discover a security vulnerability, please report it responsibly.

### How to Report

Please do **not** create a public GitHub issue for security vulnerabilities.

Instead, contact the project maintainers with:

- A detailed description of the vulnerability.
- Steps to reproduce the issue.
- The potential impact.
- Any suggested fix (if available).

---

## Response Process

After receiving a vulnerability report, we will:

1. Acknowledge receipt of the report.
2. Investigate the issue.
3. Validate the vulnerability.
4. Develop and test a fix.
5. Release a security update if necessary.
6. Notify the reporter once the issue has been resolved.

---

## Scope

This policy applies to all components of the project, including:

- Frontend (React + Vite)
- Backend (Node.js + Express)
- MongoDB database integration
- Authentication and authorization
- API endpoints
- File upload functionality
- CSV import/export
- PDF and Excel generation
- Email services
- Background jobs
- Redis caching

---

## Security Best Practices

Developers and contributors should:

- Keep dependencies up to date.
- Never commit secrets, passwords, API keys, or `.env` files.
- Validate and sanitize all user input.
- Follow secure authentication and authorization practices.
- Use HTTPS in production.
- Apply the principle of least privilege.
- Regularly review third-party packages for vulnerabilities.

---

## Sensitive Information

Do not include any of the following in bug reports or pull requests:

- Passwords
- JWT secrets
- Google OAuth credentials
- SMTP credentials
- MongoDB connection strings
- Redis connection strings
- Personal employee data

Use placeholder values when sharing configuration examples.

---

## Disclosure Policy

Please allow adequate time for the vulnerability to be investigated and resolved before publicly disclosing any security issues.

We appreciate responsible disclosure and will work to resolve confirmed vulnerabilities as quickly as possible.

---

## Acknowledgements

We appreciate security researchers and contributors who help improve the security of PaySphere through responsible disclosure.