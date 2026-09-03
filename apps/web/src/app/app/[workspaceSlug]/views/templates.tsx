"use client";

import type { TemplateDefinition, WorkstreamKey } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  CheckCircle2,
  Download,
  FileText,
  Save,
  Search,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { downloadCsv } from "@/lib/download";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import { saveTemplateAction } from "../../actions";

type Props = {
  data: WorkspaceViewData;
  templates: TemplateDefinition[];
};

function valueAsString(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function TemplatesView({ data, templates }: Props) {
  const [query, setQuery] = useState("");
  const [workstream, setWorkstream] = useState<WorkstreamKey | "all">("all");
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [savedValues, setSavedValues] = useState(
    Object.fromEntries(
      data.templateInstances.map((instance) => [
        instance.templateId,
        instance.values,
      ]),
    ),
  );
  const selected = templates.find((template) => template.id === selectedId);
  const visible = useMemo(
    () =>
      templates.filter(
        (template) =>
          (workstream === "all" || template.workstream === workstream) &&
          `${template.name} ${template.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, templates, workstream],
  );
  const workstreams = [
    ...new Set(templates.map((template) => template.workstream)),
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[370px_1fr]">
      <section>
        <Card className="mb-4 p-4">
          <label className="relative block">
            <Search
              size={14}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className="field h-10 min-h-10 pl-9"
              placeholder="Search templates"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            className="field mt-2 h-10 min-h-10 text-xs"
            value={workstream}
            onChange={(event) =>
              setWorkstream(event.target.value as WorkstreamKey | "all")
            }
          >
            <option value="all">All workstreams</option>
            {workstreams.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </Card>

        <div className="space-y-2">
          {visible.map((template) => {
            const active = selectedId === template.id;
            const saved = Boolean(savedValues[template.id]);
            return (
              <button
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-[var(--purple)] bg-white shadow-sm"
                    : "border-[var(--border)] bg-white/60 hover:bg-white"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    active
                      ? "bg-[var(--purple-soft)] text-[var(--purple)]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {saved ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{template.name}</strong>
                  <span className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                    {template.workstream.replaceAll("-", " ")} ·{" "}
                    {template.format}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="min-w-0">
        {selected ? (
          <TemplateEditor
            key={selected.id}
            data={data}
            template={selected}
            initialValues={savedValues[selected.id] ?? {}}
            onSaved={(values) =>
              setSavedValues((current) => ({
                ...current,
                [selected.id]: values,
              }))
            }
          />
        ) : (
          <Card className="p-12 text-center text-sm text-[var(--ink-muted)]">
            Choose a template.
          </Card>
        )}
      </section>
    </div>
  );
}

function TemplateEditor({
  data,
  template,
  initialValues,
  onSaved,
}: {
  data: WorkspaceViewData;
  template: TemplateDefinition;
  initialValues: Record<string, unknown>;
  onSaved: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function setValue(id: string, value: unknown) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  function save() {
    setMessage("");
    startTransition(async () => {
      await saveTemplateAction({
        workspaceSlug: data.workspace.slug,
        workspaceId: data.workspace.id,
        templateId: template.id,
        values,
      });
      onSaved(values);
      setMessage("Saved to this company workspace.");
    });
  }

  function exportTemplate() {
    downloadCsv(
      `${data.workspace.slug}-${template.id}.csv`,
      template.fields.map((field) => field.label),
      [template.fields.map((field) => values[field.id] ?? "")],
    );
  }

  return (
    <Card className="overflow-hidden">
      <header className="border-b border-[var(--border)] bg-white p-6">
        <p className="eyebrow">{template.workstream.replaceAll("-", " ")}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {template.name}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          {template.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-md bg-[var(--purple-soft)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--purple)]">
            Interactive
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
            {template.format} export
          </span>
        </div>
      </header>

      <div className="grid gap-5 p-6 sm:grid-cols-2">
        {template.fields.map((field) => {
          const common = {
            id: `${template.id}-${field.id}`,
            required: field.required,
          };
          return (
            <label
              key={field.id}
              className={
                field.type === "long-text" ? "sm:col-span-2" : undefined
              }
            >
              <span className="label">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "long-text" ? (
                <textarea
                  {...common}
                  className="field min-h-28 resize-y"
                  value={valueAsString(values[field.id])}
                  onChange={(event) => setValue(field.id, event.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  {...common}
                  className="field"
                  value={valueAsString(values[field.id])}
                  onChange={(event) => setValue(field.id, event.target.value)}
                >
                  <option value="">Select...</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <span className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3">
                  <input
                    {...common}
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--purple)]"
                    checked={Boolean(values[field.id])}
                    onChange={(event) =>
                      setValue(field.id, event.target.checked)
                    }
                  />
                  <span className="text-sm">
                    {Boolean(values[field.id]) ? "Complete" : "Open"}
                  </span>
                </span>
              ) : (
                <input
                  {...common}
                  type={
                    field.type === "url"
                      ? "url"
                      : field.type === "date"
                        ? "date"
                        : field.type === "number"
                          ? "number"
                          : "text"
                  }
                  className="field"
                  value={valueAsString(values[field.id])}
                  onChange={(event) =>
                    setValue(
                      field.id,
                      field.type === "number"
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
              {field.help ? <span className="help">{field.help}</span> : null}
            </label>
          );
        })}
      </div>

      <footer className="flex flex-col gap-3 border-t border-[var(--border)] bg-slate-50 px-6 py-4 sm:flex-row sm:items-center">
        {message ? (
          <p className="text-xs font-semibold text-emerald-700">{message}</p>
        ) : (
          <p className="text-xs text-[var(--ink-muted)]">
            Values are isolated to {data.workspace.name}.
          </p>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportTemplate}>
            <Download size={14} /> Download CSV
          </Button>
          <Button onClick={save} disabled={pending}>
            <Save size={14} /> {pending ? "Saving..." : "Save template"}
          </Button>
        </div>
      </footer>
    </Card>
  );
}
