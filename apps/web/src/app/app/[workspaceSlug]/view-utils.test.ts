import { describe, expect, it } from "vitest";
import type { WorkspaceTaskView } from "@/lib/workspace-data";
import { getDirectTaskRelations } from "./view-utils";

function task(
  id: string,
  masterTaskId: string,
  dependencies: string[] = [],
  status: WorkspaceTaskView["status"] = "not-started",
): WorkspaceTaskView {
  return {
    id,
    workspaceId: "workspace",
    masterTaskId,
    workstream: "leadership",
    phase: "days-1-30",
    title: `Task ${id}`,
    description: "A roadmap task used to test dependency relationships.",
    outcome: "A tested dependency relationship.",
    status,
    priority: "high",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    percentComplete: status === "complete" ? 100 : 0,
    ownerId: null,
    ownerRole: "CFO",
    financeResponsibility: "owns",
    notes: "",
    recommendationReason: "Needed for the relationship test.",
    dependencies,
    evidenceLinks: [],
    evidenceRequirements: [],
    deliverables: ["Test output"],
    tags: [],
    cadence: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("direct task relationships", () => {
  it("separates prerequisites, open blockers, and downstream tasks", () => {
    const tasks = [
      task("a", "master-a", [], "complete"),
      task("b", "master-b"),
      task("c", "master-c", [], "not-applicable"),
      task("focus", "master-focus", ["master-a", "master-b", "master-c"]),
      task("downstream", "master-downstream", ["master-focus"]),
      task("unrelated", "master-unrelated"),
    ];

    const relations = getDirectTaskRelations(tasks, "focus");

    expect(relations.prerequisites.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(relations.openPrerequisites.map((item) => item.id)).toEqual(["b"]);
    expect(relations.dependents.map((item) => item.id)).toEqual([
      "downstream",
    ]);
    expect([...relations.relatedTaskIds].sort()).toEqual(
      ["a", "b", "c", "downstream", "focus"].sort(),
    );
  });

  it("returns an empty relationship set without a selected task", () => {
    const relations = getDirectTaskRelations([], null);
    expect(relations.prerequisites).toEqual([]);
    expect(relations.dependents).toEqual([]);
    expect(relations.relatedTaskIds.size).toBe(0);
  });
});
