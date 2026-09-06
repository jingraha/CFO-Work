import {
  isSatisfiedTask, type AgentRunView, type SystemConnection, type TaskReadiness, type TaskStatus,
} from "@cfo/domain";
import { findPlaybookForTask, skills } from "./playbooks";

export type ReadinessTask = {
  id: string; masterTaskId: string; title: string; status: TaskStatus; dependencies: string[];
};

export function taskSkill(task: Pick<ReadinessTask, "title" | "masterTaskId">) {
  return skills.find((book) => task.masterTaskId === `agent-${book.id}`) ?? findPlaybookForTask(task.title);
}

export function getTaskReadiness(
  task: ReadinessTask, tasks: ReadinessTask[], systems: SystemConnection[], initialized: boolean, runs: AgentRunView[],
): TaskReadiness {
  const skill = taskSkill(task);
  const run = runs.find((item) => item.taskId === task.id && item.playbookId !== "output-specification");
  const blockers: TaskReadiness["blockers"] = [];
  const requiresEvidence = skill?.id === "team-assessment";
  if (!initialized) blockers.push({ kind: "setup", label: "Connect your work areas in Connectors & skills." });
  if (!skill) blockers.push({ kind: "skill", label: "No execution skill matches this task yet. An agent can outline the required output, but cannot complete the work." });
  for (const systemId of skill?.contract.requiredSystems ?? []) {
    if (!systems.some((system) => system.id === systemId && system.connected)) {
      blockers.push({ kind: "connector", systemId, label: `Connect ${systemId === "gmail" && requiresEvidence ? "Gmail / assessment evidence" : systemId}.` });
    }
  }
  const dependencies = [...task.dependencies, ...(skill?.dependsOn ?? []).map((id) => `agent-${id}`)]
    .filter((id) => id !== task.masterTaskId);
  for (const dependency of new Set(dependencies)) {
    const prerequisite = tasks.find((item) => item.masterTaskId === dependency);
    if (!prerequisite) blockers.push({ kind: "dependency", label: `Missing prerequisite: ${dependency}.` });
    else if (!isSatisfiedTask(prerequisite.status)) blockers.push({
      kind: "dependency", taskId: prerequisite.id, label: `Finish: ${prerequisite.title}.`,
    });
    const predecessor = runs.find((item) => item.taskId === prerequisite?.id);
    if (prerequisite && predecessor?.status === "completed" && predecessor.artifact?.sources.some((source) =>
      !systems.some((system) => system.id === source.systemId && system.connected && system.revision === source.revision))) {
      blockers.push({ kind: "dependency", taskId: prerequisite.id, label: `Rebuild: ${prerequisite.title}. Its source evidence changed.` });
    }
  }
  if (requiresEvidence && !systems.some((system) => system.id === "gmail" &&
    system.records.some((record) => ["meeting-transcript", "assessment-note"].includes(record.kind) &&
      record.data.taskId === task.id && typeof record.data.text === "string" && record.data.text.length >= 40))) {
    blockers.push({ kind: "evidence", label: "Add meeting transcript text or assessment notes. A Word document is not required." });
  }
  if (task.status === "blocked") blockers.push({ kind: "dependency", label: "This task is manually blocked. Resolve the issue in its task notes." });
  const state: TaskReadiness["state"] = run?.status === "needs-review" ? "review"
    : run?.status === "running" || (run?.status === "queued" && run.requested !== false) ? "working"
    : run?.status === "completed" || isSatisfiedTask(task.status) ? "completed"
    : !skill ? "unavailable" : blockers.length ? "blocked" : "ready";
  return {
    taskId: task.id, skillId: skill?.id ?? null, skillTitle: skill?.title ?? null,
    state, blockers, requiresEvidence,
    inputHint: requiresEvidence ? "Use interview transcripts, manager meeting notes, or text copied from an assessment document."
      : skill ? `Uses ${skill.contract.requiredSystems.join(", ")} records; generates ${skill.contract.deliverables[0]?.toLowerCase() ?? "a draft"}.`
        : "No supported execution skill. Keep this task human-owned or request an output specification.",
  };
}
