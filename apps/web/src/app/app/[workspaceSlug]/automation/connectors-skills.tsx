"use client";

import { createMockSystems } from "@cfo/automation";
import { SYSTEM_IDS, type SystemConnection, type SystemId } from "@cfo/domain";
import { Button, Card, cn } from "@cfo/ui";
import { CheckCircle2, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { setSystemConnectionsAction } from "@/app/app/automation-actions";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import {
  EnvironmentDialog,
  ErrorNotice,
  mutedClass,
  readableTime,
  systemInfo,
} from "./environment-ui";
import { SkillsLibrary } from "./skills-library";
import { SystemBrowser, SystemConsent } from "./systems-browser";
import type { AutomationController } from "./use-automation";

type Props = {
  data: WorkspaceViewData;
  automation: AutomationController;
  onOpenWork: () => void;
};

type Tab = "connectors" | "skills";
type DialogState =
  | { kind: "browse"; systemId: SystemId }
  | { kind: "manage"; systemId: SystemId }
  | { kind: "bulk" }
  | null;

type ConnectorCard = {
  id: SystemId;
  label: string;
  description: string;
  scopes: string[];
  recordCount: number;
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  system: SystemConnection | null;
};

function orderSystemIds(ids: Iterable<SystemId>) {
  const selected = new Set(ids);
  return SYSTEM_IDS.filter((id) => selected.has(id));
}

export function ConnectorsSkills({ data, automation, onOpenWork }: Props) {
  const [tab, setTab] = useState<Tab>("connectors");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedIds, setSelectedIds] = useState<SystemId[]>([]);
  const snapshot = automation.snapshot;

  const previewSystems = useMemo(() => {
    const preview = data.profile
      ? createMockSystems(data.profile)
      : SYSTEM_IDS.map((id) => ({
        id,
        name: systemInfo[id].name,
        category: id,
        description: systemInfo[id].description,
        scopes: ["local:records:read"],
        records: [],
      }));
    const next = new Map(preview.map((system) => [system.id, system]));
    return next;
  }, [data.profile]);

  const connectorCards = useMemo<ConnectorCard[]>(() => {
    const live = new Map((snapshot?.systems ?? []).map((system) => [system.id, system]));
    return SYSTEM_IDS.map((id) => {
      const system = live.get(id) ?? null;
      const preview = previewSystems.get(id);
      return {
        id,
        label: systemInfo[id].name,
        description: systemInfo[id].description,
        scopes: system?.scopes ?? preview?.scopes ?? [],
        recordCount: system?.records.length ?? preview?.records.length ?? 0,
        connected: system?.connected ?? false,
        connectedAt: system?.connectedAt ?? null,
        lastSyncAt: system?.lastSyncAt ?? null,
        system,
      };
    });
  }, [previewSystems, snapshot?.systems]);

  const connectedIds = useMemo(
    () => connectorCards.filter((connector) => connector.connected).map((connector) => connector.id),
    [connectorCards],
  );
  const disconnectedIds = useMemo(
    () => connectorCards.filter((connector) => !connector.connected).map((connector) => connector.id),
    [connectorCards],
  );
  const selectedConnectors = useMemo(() => {
    const selected = new Set(selectedIds);
    return connectorCards.filter((connector) => !connector.connected && selected.has(connector.id));
  }, [connectorCards, selectedIds]);

  const dialogSystem = dialog && dialog.kind !== "bulk"
    ? connectorCards.find((connector) => connector.id === dialog.systemId)?.system ?? null
    : null;

  async function connectSelected() {
    if (!selectedConnectors.length) return;
    const connected = await automation.execute("connectors-bulk-connect", () => setSystemConnectionsAction({
      ...automation.base,
      systemIds: selectedConnectors.map((connector) => connector.id),
      connected: true,
    }));
    if (connected) {
      setSelectedIds([]);
      setDialog(null);
    }
  }

  function toggleSelection(systemId: SystemId, checked: boolean) {
    setSelectedIds((current) => checked
      ? orderSystemIds([...current, systemId])
      : current.filter((id) => id !== systemId));
  }

  const dialogTitle = dialog?.kind === "bulk"
    ? `Grant access to ${selectedConnectors.length} connector${selectedConnectors.length === 1 ? "" : "s"}`
    : dialog?.kind === "browse"
      ? `${dialogSystem?.name ?? "Connector"} records`
      : dialog?.kind === "manage"
        ? `Manage ${dialogSystem?.name ?? "connector"} access`
        : "";

  return (
    <div className="space-y-4" data-testid="connectors-skills">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Choose your work areas</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Local demo only
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Connect the areas of work you need, then review the skill library before starting tasks from Workstreams.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={automation.busy}
          onClick={() => void automation.refresh()}
          aria-label="Refresh connectors and skills"
        >
          Refresh
        </Button>
      </div>

      <ErrorNotice>{automation.error}</ErrorNotice>
      {!automation.editable && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          View-only access. You can browse connected demo sources. A finance editor or CFO admin can grant new access.
        </p>
      )}
      {automation.busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Saving your connector access…
        </p>
      )}

      <nav className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Connectors and skills sections">
        {([
          { id: "connectors", label: "Connectors" },
          { id: "skills", label: "Skill library" },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`${item.id}-tab`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              tab === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {!snapshot ? (
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading connectors and skills…
        </Card>
      ) : tab === "connectors" ? (
        <ConnectorsPanel
          initialized={snapshot.initialized}
          connectors={connectorCards}
          selectedIds={selectedIds}
          selectedCount={selectedConnectors.length}
          editable={automation.editable}
          busy={automation.busy}
          onToggle={toggleSelection}
          onSelectAll={() => setSelectedIds(disconnectedIds)}
          onClear={() => setSelectedIds([])}
          onBulkConnect={() => setDialog({ kind: "bulk" })}
          onBrowse={(systemId) => setDialog({ kind: "browse", systemId })}
          onManage={(systemId) => setDialog({ kind: "manage", systemId })}
        />
      ) : (
        <SkillsLibrary playbooks={snapshot.playbooks} connectedIds={connectedIds} onOpenWork={onOpenWork} />
      )}

      {dialog && (
        <EnvironmentDialog
          key={dialog.kind === "bulk" ? selectedConnectors.map((connector) => connector.id).join("|") : dialog.systemId}
          title={dialogTitle}
          error={automation.error}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "bulk" ? (
            <BulkConsentContent systems={selectedConnectors} busy={automation.busy} onConfirm={() => void connectSelected()} />
          ) : dialog.kind === "browse" && dialogSystem?.connected ? (
            <SystemBrowser
              system={dialogSystem}
              base={automation.base}
              editable={automation.editable}
              busy={automation.busy}
              execute={automation.execute}
            />
          ) : dialog.kind === "manage" && dialogSystem?.connected ? (
            <SystemConsent
              system={dialogSystem}
              base={automation.base}
              busy={automation.busy}
              execute={automation.execute}
              onDone={() => setDialog(null)}
            />
          ) : (
            <p className={mutedClass}>This connector is no longer available. Refresh and try again.</p>
          )}
        </EnvironmentDialog>
      )}
    </div>
  );
}

function ConnectorsPanel({
  initialized,
  connectors,
  selectedIds,
  selectedCount,
  editable,
  busy,
  onToggle,
  onSelectAll,
  onClear,
  onBulkConnect,
  onBrowse,
  onManage,
}: {
  initialized: boolean;
  connectors: ConnectorCard[];
  selectedIds: SystemId[];
  selectedCount: number;
  editable: boolean;
  busy: boolean;
  onToggle: (systemId: SystemId, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onBulkConnect: () => void;
  onBrowse: (systemId: SystemId) => void;
  onManage: (systemId: SystemId) => void;
}) {
  const connectedCount = connectors.filter((connector) => connector.connected).length;
  const selected = new Set(selectedIds);
  const disconnectedCount = connectors.length - connectedCount;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{connectedCount} of {connectors.length} sources available</p>
          <p className={mutedClass}>
            {initialized
              ? "Connect the sources you need, or browse the ones already available."
              : "Select the local demo sources you want. Your first grant safely initializes them without starting work."}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!disconnectedCount || busy}
              onClick={onSelectAll}
              aria-label="Select all disconnected connectors"
            >
              Select all disconnected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!selectedIds.length || busy}
              onClick={onClear}
              aria-label="Clear selected connectors"
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={!selectedCount || busy}
              onClick={onBulkConnect}
              aria-label={`Connect selected connectors (${selectedCount})`}
              data-testid="bulk-connect-button"
            >
              Connect selected ({selectedCount})
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {connectors.map((connector) => {
          const info = systemInfo[connector.id];
          const Icon = info.icon;
          const selectable = editable && !connector.connected;
          return (
            <Card key={connector.id} className={cn("p-4", !connector.connected && selected.has(connector.id) && "border-purple-400 bg-purple-50/40")} data-testid={`connector-${connector.id}`}>
              <div className="flex items-start gap-3">
                <span className={cn("rounded-xl p-2.5", info.color)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">{connector.label}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{connector.description}</p>
                    </div>
                    {selectable ? (
                      <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          disabled={busy}
                          className="size-4 accent-[var(--purple)]"
                          checked={selected.has(connector.id)}
                          onChange={(event) => onToggle(connector.id, event.target.checked)}
                          aria-label={`Select ${connector.label}`}
                          data-testid={`connector-checkbox-${connector.id}`}
                        />
                        Select
                      </label>
                    ) : (
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
                        connector.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                      )}
                      >
                        {connector.connected ? "Connected" : "Disconnected"}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{connector.scopes.length} read scope{connector.scopes.length === 1 ? "" : "s"}</span>
                    <span>{connector.recordCount} sample record{connector.recordCount === 1 ? "" : "s"}</span>
                    {connector.connected && <span>Last sync {readableTime(connector.lastSyncAt)}</span>}
                    {!connector.connected && connector.connectedAt && <span>Previously granted {readableTime(connector.connectedAt)}</span>}
                  </div>
                </div>
              </div>
              {connector.connected && connector.system && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onBrowse(connector.id)}
                    aria-label={`Browse ${connector.label} records`}
                  >
                    Browse records
                  </Button>
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onManage(connector.id)}
                      aria-label={`Manage ${connector.label} access`}
                    >
                      Manage / disconnect
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function BulkConsentContent({
  systems,
  busy,
  onConfirm,
}: {
  systems: ConnectorCard[];
  busy: boolean;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="space-y-5" data-testid="bulk-consent-dialog">
      <div className="flex items-start gap-3 rounded-xl bg-purple-50 p-4 text-purple-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h3 className="font-semibold">Synthetic read access only</h3>
          <p className="mt-1 text-sm leading-6">No passwords or live accounts. No new jobs are requested. Previously queued work can resume when its inputs become available.</p>
        </div>
      </div>
      {!systems.length ? (
        <p className={mutedClass}>Choose at least one disconnected connector before granting access.</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border border-[var(--border)]">
          {systems.map((system) => (
            <section key={system.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">{system.label}</h3>
              <ul className="space-y-1">
                {system.scopes.map((scope) => (
                  <li key={scope} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="size-4 text-slate-400" aria-hidden="true" />
                    <code className="break-all">{scope}</code>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--purple)]"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          aria-label="Confirm synthetic read access"
        />
        <span>I understand these connectors expose synthetic read-only demo records for local workflows, not live systems.</span>
      </label>
      <Button disabled={!confirmed || !systems.length || busy} onClick={onConfirm}>
        <Link2 className="size-4" aria-hidden="true" />
        Grant access
      </Button>
    </div>
  );
}
