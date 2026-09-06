"use client";

import { MockRecordSchema, type MockRecord, type SystemConnection, type SystemId } from "@cfo/domain";
import { Button, Card, cn } from "@cfo/ui";
import { CheckCircle2, ChevronRight, Link2, Search, ShieldCheck, Unlink } from "lucide-react";
import { useState } from "react";
import { setSystemConnectionAction, updateMockRecordAction } from "@/app/app/automation-actions";
import {
  ErrorNotice, fieldClass, mutedClass, readableTime, systemInfo,
  type ActionBase, type ExecuteAction,
} from "./environment-ui";

export function SystemsCenter({ systems, editable, busy, onBrowse, onConnect }: {
  systems: SystemConnection[]; editable: boolean; busy: boolean;
  onBrowse: (systemId: SystemId) => void; onConnect: (systemId: SystemId) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Your finance systems</h2>
        <p className={mutedClass}>Browse the synthetic company. Grant read access to each system before the demo agents can use its records.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {systems.map((system) => {
          const info = systemInfo[system.id];
          const Icon = info.icon;
          return (
            <Card key={system.id} className="flex flex-col p-5" data-testid={`system-${system.id}`}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className={cn("rounded-xl p-3", info.color)}><Icon className="size-6" aria-hidden="true" /></div>
                <span className="rounded-md border border-[var(--border)] bg-slate-50 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-500">MOCK</span>
              </div>
              <h3 className="font-semibold">{system.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ink-muted)]">{system.description}</p>
              <div className={cn("mt-4 flex items-center gap-1.5 text-xs font-semibold", system.connected ? "text-emerald-700" : "text-slate-500")}>
                {system.connected ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Unlink className="size-4" aria-hidden="true" />}
                {system.connected ? "Connected · synthetic read access" : "Disconnected · no agent access"}
              </div>
              <p className="mt-2 text-xs text-slate-500">{system.records.length} records · revision {system.revision}</p>
              <p className="mt-1 text-xs text-slate-500">Last sync: {readableTime(system.lastSyncAt)}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <Button size="sm" variant="secondary" onClick={() => onBrowse(system.id)}>Browse records <ChevronRight className="size-3.5" /></Button>
                {editable && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onConnect(system.id)}>{system.connected ? "Manage access" : "Connect mock"}</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function SystemConsent({ system, base, busy, execute, onDone }: {
  system: SystemConnection; base: ActionBase; busy: boolean; execute: ExecuteAction; onDone: () => void;
}) {
  const [consented, setConsented] = useState(false);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-start gap-3 rounded-xl bg-purple-50 p-4 text-purple-950">
        <ShieldCheck className="mt-0.5 size-6 shrink-0" />
        <div><h3 className="font-semibold">Synthetic records only</h3><p className="mt-1 text-sm leading-6">This is not OAuth. No account is linked, no subscription is required, and we never ask for passwords or tokens.</p></div>
      </div>
      <div>
        <h3 className="font-semibold">Read permissions for {system.name}</h3>
        <ul className="mt-3 space-y-2">{system.scopes.map((scope) => <li className="flex items-center gap-2 text-sm" key={scope}><CheckCircle2 className="size-4 text-slate-400" /><code className="break-all">{scope}</code></li>)}</ul>
      </div>
      <p className={mutedClass}>Read access lets deterministic demo agents cite this system&apos;s synthetic records. It never grants access to a real provider. Editing demo records is a separate, explicit workspace action.</p>
      {system.connected ? (
        <>
          <p className={mutedClass}>Disconnecting blocks subsequent runs that need this source. Existing artifacts keep their original citations and revisions.</p>
          <Button variant="danger" disabled={busy} onClick={async () => {
            if (await execute(`disconnect-${system.id}`, () => setSystemConnectionAction({ ...base, systemId: system.id, connected: false }))) onDone();
          }}><Unlink className="size-4" />Disconnect mock system</Button>
        </>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 text-sm">
            <input type="checkbox" className="mt-1 accent-[var(--purple)]" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
            <span>I consent to read access for the synthetic {system.name} records listed above.</span>
          </label>
          <Button disabled={!consented || busy} onClick={async () => {
            if (await execute(`connect-${system.id}`, () => setSystemConnectionAction({ ...base, systemId: system.id, connected: true }))) onDone();
          }}><Link2 className="size-4" />Grant mock read access</Button>
        </>
      )}
    </div>
  );
}

export function SystemBrowser({ system, initialRecordId, base, editable, busy, execute }: {
  system: SystemConnection; initialRecordId?: string | undefined; base: ActionBase; editable: boolean; busy: boolean; execute: ExecuteAction;
}) {
  const [query, setQuery] = useState("");
  const [recordId, setRecordId] = useState(initialRecordId ?? system.records[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const records = system.records.filter((record) => JSON.stringify(record).toLowerCase().includes(query.toLowerCase()));
  const selected = system.records.find((record) => record.id === recordId);
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
        MOCK SYSTEM · {system.connected ? "Connected for synthetic read access" : "Disconnected — agents cannot read these records"} · Revision {system.revision}
        <br />Last sync: {readableTime(system.lastSyncAt)}. Changes affect subsequent runs, not previously generated artifacts.
      </div>
      <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="relative block"><span className="sr-only">Search mock records</span><Search className="absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden="true" /><input className={cn(fieldClass, "pl-9")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records…" /></label>
          <p className="text-xs text-slate-500">{records.length} of {system.records.length} records</p>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {records.map((record) => (
              <button key={record.id} disabled={editing} aria-pressed={record.id === recordId} onClick={() => setRecordId(record.id)} className={cn("w-full rounded-lg border p-3 text-left transition disabled:opacity-50", record.id === recordId ? "border-purple-200 bg-purple-50" : "border-transparent hover:bg-slate-50")}>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{record.kind}</span>
                <span className="mt-1 block text-sm font-medium">{record.title}</span>
              </button>
            ))}
            {!records.length && <p className={mutedClass}>No records match this search.</p>}
          </div>
          {editing && <p className="text-xs text-amber-800">Save or cancel your edit before selecting another record.</p>}
        </div>
        <div className="min-w-0">
          {selected ? <RecordDetail key={selected.id} record={selected} system={system} base={base} editable={editable} busy={busy} execute={execute} editing={editing} setEditing={setEditing} /> : <p className={mutedClass}>This source record is no longer available. Choose a record from the list.</p>}
        </div>
      </div>
    </div>
  );
}

function RecordDetail({ record, system, base, editable, busy, execute, editing, setEditing }: {
  record: MockRecord; system: SystemConnection; base: ActionBase; editable: boolean; busy: boolean;
  execute: ExecuteAction; editing: boolean; setEditing: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [fields, setFields] = useState<MockRecord["data"]>({});
  const [revision, setRevision] = useState(system.revision);
  const [error, setError] = useState("");
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs text-slate-500">{record.kind} · {record.id}</p><h3 className="mt-1 text-lg font-semibold">{record.title}</h3></div>
        {editable && !editing && <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setFields(record.data); setDraft(JSON.stringify(record.data, null, 2)); setRevision(system.revision); setError(""); setEditing(true); }}>Edit mock record</Button>}
      </div>
      {editing ? (
        <form className="space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          let data: unknown;
          try { data = JSON.parse(draft); } catch { setError("Invalid JSON. Use a JSON object with quoted keys and valid values."); return; }
          const parsed = MockRecordSchema.safeParse({ ...record, data });
          if (!parsed.success) { setError("Record data must be a JSON object containing only text, finite numbers, booleans, or null. Nested objects and arrays are not supported."); return; }
          if (await execute(`record-${record.id}`, () => updateMockRecordAction({ ...base, systemId: system.id, record: parsed.data, expectedRevision: revision }), false)) setEditing(false);
        }}>
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(fields).map(([key, value]) => {
            const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
            const update = (next: string | number | boolean | null) => {
              const nextFields = { ...fields, [key]: next }; setFields(nextFields); setDraft(JSON.stringify(nextFields, null, 2));
            };
            return <label key={key} className={cn("block text-xs font-medium", typeof value === "string" && value.length > 80 && "sm:col-span-2")}>
              {label}
              {typeof value === "boolean" ? <input type="checkbox" className="ml-2 accent-[var(--purple)]" checked={value} onChange={(event) => update(event.target.checked)} />
                : typeof value === "string" && value.length > 80 ? <textarea rows={4} className={cn(fieldClass, "mt-1")} value={value} onChange={(event) => update(event.target.value)} />
                  : <input className={cn(fieldClass, "mt-1")} type={typeof value === "number" ? "number" : "text"} step="any" value={value === null ? "" : String(value)}
                    onChange={(event) => update(typeof value === "number" ? Number(event.target.value) : event.target.value)} />}
            </label>;
          })}</div>
          <details><summary className="cursor-pointer text-xs text-slate-500">Advanced JSON editor</summary>
            <label className="mt-2 block text-sm font-medium" htmlFor="mock-record-json">Mock record data (JSON)</label>
            <textarea id="mock-record-json" className={cn(fieldClass, "min-h-72 font-mono text-xs leading-6")} value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
          </details>
          <p className="text-xs leading-5 text-slate-500">Editing revision {revision}. The record ID, kind, and title stay unchanged. Use synthetic data only; do not paste credentials or real personal information.</p>
          {system.revision !== revision && <ErrorNotice>This system changed while you were editing. Your draft is preserved. Cancel and reopen the editor to use the latest revision.</ErrorNotice>}
          <ErrorNotice>{error}</ErrorNotice>
          <div className="flex gap-2"><Button type="submit" disabled={busy || revision !== system.revision}>Save mock record</Button><Button variant="secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel edit</Button></div>
        </form>
      ) : (
        <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {Object.entries(record.data).map(([key, value]) => <div key={key} className="grid gap-1 p-3 sm:grid-cols-[160px_minmax(0,1fr)]"><dt className="break-words text-xs font-semibold text-slate-500">{key}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6">{value === null ? "—" : String(value)}</dd></div>)}
        </dl>
      )}
    </section>
  );
}
