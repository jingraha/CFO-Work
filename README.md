# Startup CFO OS

A portable finance operating system for a CFO entering a Series B/C AI
startup. It combines a tailored first-year roadmap, recurring finance cadence,
hiring plan, vendor decision center, working templates, and four downloadable
Excel operating models.

## What ships

- Ten CFO workstreams with a complete master checklist and a company-tailored
  roadmap.
- Interactive task list and Gantt with owners, dependencies, dates, status,
  notes, and external evidence links.
- Trigger-based finance hiring plan, starting with Controller coverage.
- Source-dated vendor comparisons and editable decision scorecards.
- Reusable finance, accounting, treasury, tax, controls, equity, and governance
  templates.
- B2B SaaS + usage, AI infrastructure, consumer subscription, and AI-enabled
  services Excel models.
- Four workspace roles, tenant isolation, audit history, and JSON/CSV exports.

## Zero-cost local start

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- Python 3.11 or newer for regenerating the Excel models

```powershell
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in with:

- Email: `cfo@example.com`
- Password: `local-demo-only`

The local profile uses file-backed PGlite under `.data\`. It does not require
Docker, a cloud database, an email provider, analytics, or a paid subscription.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run models:test
```

See `docs\LOCAL_SETUP.md`, `docs\OPERATING_GUIDE.md`, and
`docs\SECURITY_AND_DEPLOYMENT.md` for details.

## Important boundary

This application is an operating and planning layer. The ERP, bank, payroll
system, cap-table platform, and company-controlled document repository remain
systems of record. The content and models do not replace legal, tax, audit,
accounting, employment, or investment advice.
