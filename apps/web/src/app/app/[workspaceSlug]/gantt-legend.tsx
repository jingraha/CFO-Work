import type { WorkstreamDefinition } from "@cfo/domain";
import { Card } from "@cfo/ui";
import { ArrowRight, CircleHelp, MousePointer2 } from "lucide-react";

export function GanttLegend({
  workstreams,
}: {
  workstreams: WorkstreamDefinition[];
}) {
  return (
    <Card className="overflow-hidden">
      <details open>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
          <CircleHelp size={16} className="text-[var(--purple)]" />
          How to read dependencies and colors
          <span className="ml-auto text-[10px] font-normal text-[var(--ink-muted)]">
            Click to collapse
          </span>
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Dependency direction
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <span className="rounded-md border-2 border-blue-500 bg-white px-2 py-1 font-semibold">
                  Needs first
                </span>
                <ArrowRight size={17} className="shrink-0 text-slate-500" />
                <span className="rounded-md border-2 border-orange-500 bg-white px-2 py-1 font-semibold">
                  Task it unblocks
                </span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-[var(--ink-muted)]">
                <MousePointer2 size={11} className="mt-0.5 shrink-0" />
                Single-click a task to isolate direct relationships.
                Dependency arrows appear in that focused view. Double-click
                the task, or use its chevron, for the full explanation.
              </p>
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Visual states
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[var(--ink-muted)]">
                <LegendItem
                  sample="bg-[var(--purple)]"
                  label="Bar fill = workstream"
                />
                <LegendItem
                  sample="border-[3px] border-[var(--ink)] bg-white"
                  label="Dark outline = selected"
                />
                <LegendItem
                  sample="border-2 border-blue-500 bg-blue-50"
                  label="Blue outline = prerequisite"
                />
                <LegendItem
                  sample="border-2 border-orange-500 bg-orange-50"
                  label="Orange outline = downstream"
                />
                <LegendItem
                  sample="bg-[var(--teal)]"
                  label="Green = complete"
                />
                <LegendItem
                  sample="border border-dashed border-red-500 bg-red-100"
                  label="Red/dashed = blocked"
                />
                <LegendItem
                  sample="bg-slate-300"
                  label="Dark segment inside bar = progress"
                />
              </div>
            </section>
          </div>

          <section className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
              Workstream colors
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {workstreams.map((stream) => (
                <span
                  key={stream.id}
                  className="flex items-center gap-1.5 text-[10px] text-[var(--ink-muted)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stream.color }}
                  />
                  {stream.shortName}
                </span>
              ))}
            </div>
          </section>
        </div>
      </details>
    </Card>
  );
}

function LegendItem({ sample, label }: { sample: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-4 w-7 rounded ${sample}`} />
      {label}
    </span>
  );
}
