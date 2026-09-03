export const migrations = [
  {
    id: "0001_initial",
    sql: `
CREATE TABLE IF NOT EXISTS schema_migration (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_idx ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  issuer text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_idx ON account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_idx ON account(issuer, account_id);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS workspace (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membership (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS membership_user_idx ON membership(user_id);

CREATE TABLE IF NOT EXISTS company_profile (
  workspace_id text PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  profile jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_task (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  master_task_id text NOT NULL,
  workstream text NOT NULL,
  phase text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  outcome text NOT NULL,
  status text NOT NULL DEFAULT 'not-started',
  priority text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  percent_complete integer NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  owner_id text REFERENCES "user"(id) ON DELETE SET NULL,
  owner_role text NOT NULL,
  finance_responsibility text NOT NULL,
  notes text NOT NULL DEFAULT '',
  recommendation_reason text NOT NULL,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cadence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, master_task_id)
);
CREATE INDEX IF NOT EXISTS task_workspace_status_idx ON workspace_task(workspace_id, status);
CREATE INDEX IF NOT EXISTS task_workspace_dates_idx ON workspace_task(workspace_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS vendor_evaluation (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  status text NOT NULL DEFAULT 'researching',
  owner_id text REFERENCES "user"(id) ON DELETE SET NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  evidence_link jsonb,
  decision text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS hiring_plan (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_id text NOT NULL,
  status text NOT NULL DEFAULT 'recommended',
  target_date date,
  owner_id text REFERENCES "user"(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role_id)
);

CREATE TABLE IF NOT EXISTS template_instance (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, template_id)
);

CREATE TABLE IF NOT EXISTS audit_event (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_workspace_created_idx ON audit_event(workspace_id, created_at);
`,
  },
  {
    id: "0002_account_issuer",
    sql: `
ALTER TABLE account ADD COLUMN IF NOT EXISTS issuer text;
UPDATE account SET issuer = 'local:' || provider_id WHERE issuer IS NULL;
ALTER TABLE account ALTER COLUMN issuer SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_idx ON account(issuer, account_id);
`,
  },
] as const;
