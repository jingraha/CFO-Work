"use client";

import type { CompanyProfile, Role } from "@cfo/domain";
import { can, permissionsFor } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  Activity,
  Database,
  Download,
  FileDown,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRoundCog,
  UserPlus,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { downloadCsv } from "@/lib/download";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import {
  createLocalMemberAction,
  importWorkspaceAction,
  updateCompanyProfileAction,
} from "../../actions";

type Props = {
  data: WorkspaceViewData;
  currentUser: { id: string; name: string; email: string };
  workstreamCount: number;
  masterTaskCount: number;
};

const roleDescriptions: Record<Role, string> = {
  "cfo-admin": "Full workspace, membership, settings, and export control.",
  "finance-editor": "Can edit company profile, tasks, vendors, hiring, and templates.",
  "task-contributor": "Can update tasks assigned to them and add evidence links.",
  viewer: "Read-only access to the operating workspace.",
};

const summaryCards: Array<{
  label: string;
  value: (input: {
    workstreamCount: number;
    masterTaskCount: number;
    memberCount: number;
    auditCount: number;
  }) => number;
  icon: LucideIcon;
  surface: string;
}> = [
  {
    label: "Workstreams",
    value: (input) => input.workstreamCount,
    icon: ShieldCheck,
    surface: "var(--purple-soft)",
  },
  {
    label: "Master tasks",
    value: (input) => input.masterTaskCount,
    icon: Activity,
    surface: "var(--blue-soft)",
  },
  {
    label: "Workspace members",
    value: (input) => input.memberCount,
    icon: UserRoundCog,
    surface: "var(--teal-soft)",
  },
  {
    label: "Audit events",
    value: (input) => input.auditCount,
    icon: Database,
    surface: "var(--orange-soft)",
  },
];

export function SettingsView({
  data,
  currentUser,
  workstreamCount,
  masterTaskCount,
}: Props) {
  const [profile, setProfile] = useState(data.profile);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveProfile() {
    if (!profile) return;
    setMessage("");
    startTransition(async () => {
      const result = await updateCompanyProfileAction(
        data.workspace.slug,
        data.workspace.id,
        profile,
      );
      setMessage(
        `Profile saved. Added ${result.tasksAdded} newly relevant tasks and ${result.hiringRolesAdded} hiring recommendations; existing work was preserved.`,
      );
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards
          .filter(
            (card) =>
              card.label !== "Audit events" ||
              can(data.workspace.role, "audit:view"),
          )
          .map(({ label, value, icon: Icon, surface }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-[var(--purple)]"
              style={{ background: surface }}
            >
              <Icon size={18} />
            </span>
            <div>
              <p className="text-xs text-[var(--ink-muted)]">
                {label}
              </p>
              <strong className="mt-1 block text-xl">
                {value({
                  workstreamCount,
                  masterTaskCount,
                  memberCount: data.members.length,
                  auditCount: data.auditEvents.length,
                })}
              </strong>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {can(data.workspace.role, "audit:view") ? (
          <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="eyebrow">Company profile</p>
            <h3 className="mt-1 font-semibold">Roadmap drivers</h3>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Profile changes affect future recommendations. They do not
              silently overwrite dates or status on existing work.
            </p>
          </div>
          {profile ? (
            <ProfileEditor profile={profile} onChange={setProfile} />
          ) : (
            <p className="p-6 text-sm text-[var(--ink-muted)]">
              No company profile is configured.
            </p>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold text-emerald-700">{message}</p>
            <Button onClick={saveProfile} disabled={!profile || pending}>
              <Save size={14} /> {pending ? "Saving..." : "Save profile"}
            </Button>
          </div>
          </Card>
        ) : null}

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--teal-soft)] text-emerald-700">
                <LockKeyhole size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold">Local private mode</p>
                <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
                  No paid or cloud service is connected
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-[var(--ink-muted)]">
              <li>Data is stored in a file-backed local Postgres database.</li>
              <li>External evidence links are stored; documents are not fetched.</li>
              <li>Production deployment remains a separate approval.</li>
            </ul>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">Portability</p>
            <h3 className="mt-1 text-sm font-semibold">
              Take the workspace with you
            </h3>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              JSON preserves company state. CSV exports make tasks and decisions
              easy to inspect outside the app.
            </p>
            <div className="mt-4 space-y-2">
              <a
                href={`/api/workspaces/${data.workspace.slug}/export`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--purple)] px-4 text-xs font-semibold text-white hover:bg-[var(--purple-dark)]"
              >
                <FileDown size={14} /> Export workspace JSON
              </a>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  downloadCsv(
                    `${data.workspace.slug}-roadmap.csv`,
                    [
                      "Workstream",
                      "Phase",
                      "Task",
                      "Status",
                      "Priority",
                      "Start",
                      "End",
                      "Owner role",
                      "Owner",
                      "Progress",
                      "Notes",
                    ],
                    data.tasks.map((task) => [
                      task.workstream,
                      task.phase,
                      task.title,
                      task.status,
                      task.priority,
                      task.startDate,
                      task.endDate,
                      task.ownerRole,
                      data.members.find((member) => member.userId === task.ownerId)
                        ?.email ?? "",
                      task.percentComplete,
                      task.notes,
                    ]),
                  )
                }
              >
                <Download size={14} /> Export roadmap CSV
              </Button>
              <WorkspaceImport />
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="eyebrow">Access</p>
            <h3 className="mt-1 font-semibold">Members and roles</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-5 py-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--purple-soft)] text-xs font-bold text-[var(--purple)]">
                  {member.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {member.name}
                    {member.userId === currentUser.id ? " (you)" : ""}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {member.email}
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-600">
                  {member.role.replaceAll("-", " ")}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] bg-slate-50 p-4">
            {(
              [
                "cfo-admin",
                "finance-editor",
                "task-contributor",
                "viewer",
              ] as Role[]
            ).map((role) => (
              <div key={role} className="mb-2 last:mb-0">
                <p className="text-[10px] font-bold uppercase text-[var(--ink)]">
                  {role.replaceAll("-", " ")} ·{" "}
                  {permissionsFor(role).length} permissions
                </p>
                <p className="text-[10px] leading-4 text-[var(--ink-muted)]">
                  {roleDescriptions[role]}
                </p>
              </div>
            ))}
            {data.workspace.role === "cfo-admin" ? (
              <MemberForm
                workspaceId={data.workspace.id}
                workspaceSlug={data.workspace.slug}
              />
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="eyebrow">Audit trail</p>
            <h3 className="mt-1 font-semibold">Recent material changes</h3>
          </div>
          <div className="max-h-[470px] divide-y divide-[var(--border)] overflow-y-auto">
            {data.auditEvents.map((event) => (
              <div key={event.id} className="flex gap-3 px-5 py-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--purple)]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {event.entityType.replaceAll("-", " ")} {event.action}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[var(--ink-muted)]">
                    {event.entityId} ·{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(event.createdAt))}
                  </p>
                </div>
              </div>
            ))}
            {data.auditEvents.length === 0 ? (
              <p className="p-8 text-center text-xs text-[var(--ink-muted)]">
                Material changes will appear here.
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <p className="text-xs leading-5 text-[var(--ink-muted)]">
          <strong className="text-[var(--ink)]">Professional boundary:</strong>{" "}
          this workspace is an operating and planning layer. The ERP, bank,
          payroll, cap-table system, and company document repository remain the
          systems of record. Content does not replace legal, tax, accounting,
          audit, employment, or investment advice.
        </p>
      </Card>
    </div>
  );
}

function WorkspaceImport() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function selectFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await importWorkspaceAction(await file.text());
        router.push(`/app/${result.slug}`);
        router.refresh();
      } catch (cause) {
        setMessage(
          cause instanceof Error ? cause.message : "Workspace import failed.",
        );
      }
    });
  }

  return (
    <div>
      <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 text-xs font-semibold hover:bg-slate-50">
        <Upload size={14} />
        {pending ? "Importing..." : "Import workspace JSON"}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={pending}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </label>
      {message ? (
        <p className="mt-2 text-[10px] text-red-700">{message}</p>
      ) : null}
    </div>
  );
}

function MemberForm({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<
    "finance-editor" | "task-contributor" | "viewer"
  >("finance-editor");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function createMember() {
    setMessage("");
    startTransition(async () => {
      try {
        await createLocalMemberAction({
          workspaceId,
          workspaceSlug,
          name,
          email,
          password,
          role,
        });
        setName("");
        setEmail("");
        setPassword("");
        setMessage("Member created. Refresh to show the new account.");
      } catch (cause) {
        setMessage(
          cause instanceof Error ? cause.message : "Member creation failed.",
        );
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-center gap-2">
        <UserPlus size={14} className="text-[var(--purple)]" />
        <p className="text-xs font-semibold">Create local member</p>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">
        Local mode has no email service. Share the temporary password securely
        and replace this flow with company SSO before production.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className="field"
          placeholder="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          type="email"
          className="field"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          type="password"
          className="field"
          placeholder="Temporary password (12+)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <select
          className="field"
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value as
                | "finance-editor"
                | "task-contributor"
                | "viewer",
            )
          }
        >
          <option value="finance-editor">Finance editor</option>
          <option value="task-contributor">Task contributor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      {message ? (
        <p className="mt-2 text-[10px] text-[var(--ink-muted)]">{message}</p>
      ) : null}
      <Button
        size="sm"
        className="mt-3"
        onClick={createMember}
        disabled={
          pending ||
          name.trim().length < 2 ||
          !email.includes("@") ||
          password.length < 12
        }
      >
        <UserPlus size={13} /> {pending ? "Creating..." : "Create member"}
      </Button>
    </div>
  );
}

function ProfileEditor({
  profile,
  onChange,
}: {
  profile: CompanyProfile;
  onChange: (profile: CompanyProfile) => void;
}) {
  function numberField(
    label: string,
    key:
      | "annualRevenueMillions"
      | "arrMillions"
      | "cashRunwayMonths"
      | "employeeCount"
      | "entityCount"
      | "closeDays"
      | "salesTaxNexusStates",
  ) {
    return (
      <label>
        <span className="label">{label}</span>
        <input
          type="number"
          min="0"
          className="field"
          value={profile[key]}
          onChange={(event) =>
            onChange({ ...profile, [key]: Number(event.target.value) })
          }
        />
      </label>
    );
  }

  return (
    <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="sm:col-span-2 lg:col-span-3">
        <span className="label">Company name</span>
        <input
          className="field"
          value={profile.name}
          onChange={(event) =>
            onChange({ ...profile, name: event.target.value })
          }
        />
      </label>
      {numberField("ARR ($M)", "arrMillions")}
      {numberField("Annual revenue ($M)", "annualRevenueMillions")}
      {numberField("Cash runway (months)", "cashRunwayMonths")}
      {numberField("Employees", "employeeCount")}
      {numberField("Legal entities", "entityCount")}
      {numberField("Current close (days)", "closeDays")}
      {numberField("US nexus states", "salesTaxNexusStates")}
      <label>
        <span className="label">Controller coverage</span>
        <select
          className="field"
          value={profile.financeTeam.controller}
          onChange={(event) =>
            onChange({
              ...profile,
              financeTeam: {
                ...profile.financeTeam,
                controller: event.target
                  .value as CompanyProfile["financeTeam"]["controller"],
              },
            })
          }
        >
          <option value="none">No coverage</option>
          <option value="fractional">Fractional</option>
          <option value="outsourced">Outsourced</option>
          <option value="full-time">Full-time</option>
        </select>
      </label>
      <label>
        <span className="label">Strategic Finance coverage</span>
        <select
          className="field"
          value={profile.financeTeam.strategicFinance}
          onChange={(event) =>
            onChange({
              ...profile,
              financeTeam: {
                ...profile.financeTeam,
                strategicFinance: event.target
                  .value as CompanyProfile["financeTeam"]["strategicFinance"],
              },
            })
          }
        >
          <option value="none">No coverage</option>
          <option value="fractional">Fractional</option>
          <option value="outsourced">Outsourced</option>
          <option value="full-time">Full-time</option>
        </select>
      </label>
    </div>
  );
}
