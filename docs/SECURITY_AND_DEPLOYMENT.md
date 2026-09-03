# Security and gated deployment

## Local security model

- Database-backed sessions and password hashing are handled by Better Auth.
- Every workspace query includes membership scope.
- Mutation permissions are enforced on the server for CFO admin, finance
  editor, task contributor, and viewer roles.
- Task contributors can update only tasks assigned to them.
- Material task, profile, vendor, hiring, template, membership, and import
  changes create audit events.
- Evidence links must use HTTPS. The server does not crawl linked content.
- Demo data contains no real company or personal information.

Do not expose the development server to the public internet or load real
financial data into an unreviewed environment.

## Production gate

No production infrastructure is provisioned by this repository. Before
deployment:

1. Approve a hosting and database budget.
2. Move from file-backed PGlite to a backed-up PostgreSQL service.
3. Set a high-entropy `BETTER_AUTH_SECRET` and the production application URL.
4. Replace local passwords with company SSO/OIDC and MFA.
5. Configure TLS, secret management, rate limiting, monitoring, backups, restore
   tests, and retention.
6. Complete a security review, tenant-isolation test, privacy review,
   subprocessor review, and incident-response plan.
7. Confirm the external-link policy and prohibit document uploads unless a
   separate security and compliance design is approved.

The domain and repository layers do not depend on Vercel, Supabase, Azure, or
another proprietary provider. A production move should require configuration
and infrastructure adapters, not a rewrite of roadmap, RBAC, vendor, hiring, or
workbook logic.

## Professional boundary

The software is not an ERP, general ledger, payroll processor, bank,
cap-table system, legal record, or audit workpaper repository. Content must be
reviewed with the company's Controller, CPA, auditor, tax adviser, counsel,
People leader, and security owner as applicable.
