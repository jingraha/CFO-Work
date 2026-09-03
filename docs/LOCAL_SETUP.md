# Local setup

## Start the application

From the repository root:

```powershell
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

The seed command is idempotent. It creates the demo CFO account and an Aperture
AI workspace only when they do not already exist.

## Local data

PGlite stores the PostgreSQL-compatible database in `.data\cfo-os`. The folder
is excluded from Git. Back up the folder while the app is stopped, or use the
workspace JSON export in the app.

To use a different local path, set `CFO_DATABASE_PATH` in `.env.local`.

## Excel model generation

The generated workbooks are committed under `apps\web\public\downloads` so the
web app does not need Python at runtime.

```powershell
npm run models:generate
npm run models:test
npm run models:test:excel
```

## Local users

The demo account is:

- Email: `cfo@example.com`
- Password: `local-demo-only`

A CFO admin can create additional local users in **Workspace & access**. Local
mode has no email delivery. Share temporary passwords through an approved
secure channel.

Before production, replace local credentials with the company's SSO/OIDC
provider and require MFA.
