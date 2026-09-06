import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { CompanyProfileSchema, SYSTEM_IDS } from "@cfo/domain";
import {
  createCredentialUser, createWorkspace, closeDatabase, getDatabase, addWorkspaceMember,
  getAutomationSnapshot, processNextAgentRun, setSystemConnections, addTaskEvidence, requestTaskAgent, updateWorkspaceTask,
  getWorkspaceSnapshot, exportEnvironment, importWorkspace,
  delegateRoadmapTask,
} from "./index";
import { workspaceTasks } from "./schema";

describe.sequential("simplified work actions", () => {
  let directory: string, admin: string, viewer: string, workspaceId: string;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "cfo-simple-"));
    process.env.CFO_DATABASE_PATH = path.join(directory, "db");
    admin = (await createCredentialUser({name: "CFO", email: "admin@simple.example", passwordHash: "test"})).id;
    viewer = (await createCredentialUser({name: "Viewer", email: "viewer@simple.example", passwordHash: "test"})).id;
    const profile = CompanyProfileSchema.parse({
      name:"Simple Demo",stage:"series-b",startDate:"2026-09-05",businessModels:["b2b-saas-usage"],
      annualRevenueMillions:10,arrMillions:12,cashRunwayMonths:18,employeeCount:90,entityCount:1,countries:["US"],
      internationalEmployees:false,closeDays:15,auditStatus:"planning",auditDueDate:null,fundraiseDate:null,nextBoardDate:null,
      accountingSystem:"quickbooks",billingModel:"hybrid",salesTaxNexusStates:5,
      financeTeam:{controller:"none",strategicFinance:"none",financeOperations:"none",tax:"outsourced",treasury:"none",staffAccountants:1},
    });
    workspaceId = (await createWorkspace({actorId:admin,name:profile.name,slug:"simple-demo",profile,roadmap:[],hiringRecommendations:[]})).id;
    await addWorkspaceMember({actorId:admin,workspaceId,userId:viewer,role:"viewer"});
  },30000);
  afterAll(async () => { await closeDatabase(); delete process.env.CFO_DATABASE_PATH; await rm(directory,{recursive:true,force:true}); });
  it("grants multiple connectors in one operation without starting unrequested work", async () => {
    await expect(setSystemConnections(viewer,workspaceId,["gmail","slack"],true)).rejects.toThrow("permission");
    await expect(setSystemConnections(admin,workspaceId,["gmail","gmail"],true)).rejects.toThrow();
    expect((await getAutomationSnapshot(admin,workspaceId)).initialized).toBe(false);
    await setSystemConnections(admin,workspaceId,["gmail","slack"],true);
    const snapshot = await getAutomationSnapshot(admin,workspaceId);
    expect(snapshot.systems.filter((system)=>system.connected).map((system)=>system.id)).toEqual(["gmail","slack"]);
    expect(snapshot.runs.every((run)=>run.requested===false)).toBe(true);
    expect(await processNextAgentRun(workspaceId)).toBe(false);
    const revision=snapshot.systems[0]!.revision;
    await setSystemConnections(admin,workspaceId,["gmail","slack"],true);
    expect((await getAutomationSnapshot(admin,workspaceId)).systems[0]!.revision).toBe(revision);
  });
  it("executes selected budget work and only its prerequisite skills", async () => {
    await setSystemConnections(admin,workspaceId,[...SYSTEM_IDS],true);
    const snapshot = await getAutomationSnapshot(admin,workspaceId);
    const budget = snapshot.runs.find((run)=>run.playbookId==="budget-variance")!;
    await requestTaskAgent(admin,workspaceId,budget.taskId);
    for(let i=0;i<20;i++){if(!await processNextAgentRun(workspaceId))break;}
    const after = await getAutomationSnapshot(admin,workspaceId);
    expect(after.runs.find((run)=>run.id===budget.id)?.status).toBe("completed");
    expect(after.runs.find((run)=>run.playbookId==="board-review")?.requested).toBe(false);
    expect(after.runs.find((run)=>run.playbookId==="board-review")?.artifact).toBeNull();
  });
  it("offers transcript evidence on team tasks, keeps human blockers, and requires draft review", async () => {
    const db = await getDatabase();
    const parent = (await getAutomationSnapshot(admin,workspaceId)).runs.find((run)=>run.playbookId==="system-inventory")!;
    await db.insert(workspaceTasks).values({
      id:"team-task",workspaceId,masterTaskId:"lead-team-skills-and-capacity-assessment",
      title:"Assess team skills, capacity, and retention risk",description:"Review team capacity with evidence.",
      outcome:"Coverage matrix",priority:"high",workstream:"leadership",phase:"days-1-30",
      startDate:"2026-09-05",endDate:"2026-09-06",ownerRole:"CFO",financeResponsibility:"owns",
      recommendationReason:"Team planning",dependencies:["agent-system-inventory"],deliverables:["Coverage matrix"],
    });
    await updateWorkspaceTask(admin,workspaceId,parent.taskId,{status:"in-progress"});
    await requestTaskAgent(admin,workspaceId,"team-task");
    expect(await processNextAgentRun(workspaceId)).toBe(false);
    let ready = (await getAutomationSnapshot(admin,workspaceId)).taskReadiness.find((item)=>item.taskId==="team-task")!;
    expect(ready.blockers.some((item)=>item.kind==="evidence")).toBe(true);
    await addTaskEvidence(admin,workspaceId,{taskId:"team-task",kind:"meeting-transcript",title:"Team interview",text:"Controller: The close has too much manual work. We need a backup owner for bank reconciliation. We need training on revenue recognition."});
    ready = (await getAutomationSnapshot(admin,workspaceId)).taskReadiness.find((item)=>item.taskId==="team-task")!;
    expect(ready.blockers.some((item)=>item.kind==="evidence")).toBe(false);
    expect(ready.blockers.some((item)=>item.kind==="dependency")).toBe(true);
    await requestTaskAgent(admin,workspaceId,parent.taskId);
    for(let i=0;i<20;i++){if(!await processNextAgentRun(workspaceId))break;}
    const report = (await getAutomationSnapshot(admin,workspaceId)).runs.find((item)=>item.taskId==="team-task")!;
    expect(report.status).toBe("needs-review");
    expect(report.artifact?.checks.every((check)=>check.passed)).toBe(true);
    expect(report.artifact?.sections[1]?.rows.some((row)=>String(row[1]).includes("backup owner"))).toBe(true);
    expect(report.artifact?.sources.every((source)=>source.recordId.startsWith("evidence-"))).toBe(true);
    const [task] = await db.select().from(workspaceTasks).where(and(eq(workspaceTasks.id,"team-task"),eq(workspaceTasks.workspaceId,workspaceId)));
    expect(task?.status).toBe("in-progress");
  });

  it("keeps task evidence linked when a workspace is imported", async () => {
    const source = await getWorkspaceSnapshot(admin, "simple-demo");
    if (!source.profile) throw new Error("Missing test profile.");
    const imported = await importWorkspace(admin, {
      name: "Imported Simple Demo", slug: "imported-simple-demo", profile: source.profile,
      tasks: source.tasks, vendorEvaluations: [], hiringPlans: [], templateInstances: [],
      automation: await exportEnvironment(admin, workspaceId),
    });
    const snapshot = await getAutomationSnapshot(admin, imported.id);
    const importedTask = (await getWorkspaceSnapshot(admin, imported.slug)).tasks.find((task) => task.masterTaskId === "lead-team-skills-and-capacity-assessment");
    const evidence = snapshot.systems.find((system) => system.id === "gmail")?.records.find((record) => record.kind === "meeting-transcript");
    expect(evidence?.data.taskId).toBe(importedTask?.id);
    expect(evidence?.data.taskId).not.toBe("team-task");
  });

  it("upgrades a saved output specification when a matching skill becomes available", async () => {
    const db = await getDatabase();
    await db.insert(workspaceTasks).values({
      id: "upgrade-budget", workspaceId, masterTaskId: "custom-budget",
      title: "Custom variance analysis", description: "Produce a budget variance report.",
      outcome: "Department variance report", priority: "high", workstream: "strategic-finance", phase: "days-31-60",
      startDate: "2026-09-05", endDate: "2026-09-06", ownerRole: "CFO", financeResponsibility: "owns",
      recommendationReason: "Budget review", deliverables: ["Department variance report"],
    });
    await delegateRoadmapTask(admin, workspaceId, "upgrade-budget");
    const before = (await getAutomationSnapshot(admin, workspaceId)).runs.find((run) => run.taskId === "upgrade-budget")!;
    expect(before.playbookId).toBe("output-specification");
    await db.update(workspaceTasks).set({ title: "Stand up budget versus actual reporting" }).where(eq(workspaceTasks.id, "upgrade-budget"));
    await requestTaskAgent(admin, workspaceId, "upgrade-budget");
    for (let i = 0; i < 20; i++) { if (!await processNextAgentRun(workspaceId)) break; }
    const after = (await getAutomationSnapshot(admin, workspaceId)).runs.find((run) => run.taskId === "upgrade-budget")!;
    expect(after.id).toBe(before.id);
    expect(after.playbookId).toBe("budget-variance");
    expect(after.status).toBe("needs-review");
    expect(after.artifact?.checks.every((check) => check.passed)).toBe(true);
  });
});
