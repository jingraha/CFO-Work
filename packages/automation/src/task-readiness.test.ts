import { describe, expect, it } from "vitest";
import { getTaskReadiness, type ReadinessTask } from "./task-readiness";
import { skills } from "./playbooks";
import type { SystemConnection } from "@cfo/domain";

const task: ReadinessTask = { id: "task-budget", masterTaskId: "sf-budget-vs-actual-reporting", title: "Stand up budget versus actual reporting", status: "not-started", dependencies: ["coa-design"] };
const system = (id: SystemConnection["id"], records: SystemConnection["records"] = []): SystemConnection => ({
  id, name: id, category: id, description: id, scopes: ["read"], records, connected: true,
  connectedAt: null, revision: 1, lastSyncAt: null,
});

describe("task agent readiness", () => {
  it("matches budget work and exposes original and skill prerequisites", () => {
    const readiness = getTaskReadiness(task, [task], [], true, []);
    expect(readiness.skillId).toBe("budget-variance");
    expect(readiness.blockers.filter((item) => item.kind === "connector")).toHaveLength(2);
    expect(readiness.blockers.filter((item) => item.kind === "dependency")).toHaveLength(3);
    expect(readiness.state).toBe("blocked");
  });
  it("shows ready only with all required evidence and prerequisites", () => {
    const prereqs = ["coa-design", "agent-close-assessment", "agent-workforce-review"].map((id) => ({
      ...task, id, masterTaskId: id, title: id, dependencies: [], status: "complete" as const,
    }));
    expect(getTaskReadiness(task, [task, ...prereqs], [system("erp"), system("planning")], true, []).state).toBe("ready");
  });
  it("accepts meeting transcripts as task-specific team evidence", () => {
    const team = { ...task, title: "Assess team skills, capacity, and retention risk", dependencies: [] };
    const missing = getTaskReadiness(team, [team], [system("gmail")], true, []);
    expect(missing.requiresEvidence).toBe(true);
    expect(missing.blockers[0]?.label).toContain("transcript");
    const record = { id: "transcript", kind: "meeting-transcript", title: "Team interview", data: { taskId: team.id, text: "Manager: We need more coverage for the close and someone to own the bank reconciliation." } };
    expect(getTaskReadiness(team, [team], [system("gmail", [record])], true, []).state).toBe("ready");
    expect(getTaskReadiness(team, [team], [system("gmail", [{ ...record, data: { ...record.data, taskId: "unrelated" } }])], true, []).state).toBe("blocked");
  });
  it("does not advertise unsupported real-world tasks as executable", () => {
    const unsupported = { ...task, title: "Obtain an external audit opinion", dependencies: [] };
    expect(getTaskReadiness(unsupported, [unsupported], [], true, []).state).toBe("unavailable");
    expect(skills.find((item) => item.id === "team-assessment")?.contract.requiresHumanApproval).toBe(true);
  });
});
