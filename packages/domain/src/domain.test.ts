import { describe, expect, it } from "vitest";
import {
  CompanyProfileSchema,
  blockedTaskIds,
  can,
  evaluateCondition,
  generateRoadmap,
  type MasterTask,
} from "./index";

const profile = CompanyProfileSchema.parse({
  name: "Demo AI",
  stage: "series-b",
  startDate: "2026-09-01",
  fiscalYearEndMonth: 12,
  businessModels: ["b2b-saas-usage"],
  annualRevenueMillions: 12,
  arrMillions: 15,
  cashRunwayMonths: 18,
  employeeCount: 95,
  entityCount: 1,
  countries: ["US"],
  internationalEmployees: false,
  closeDays: 18,
  auditStatus: "planning",
  auditDueDate: "2027-03-31",
  fundraiseDate: null,
  nextBoardDate: "2026-10-15",
  accountingSystem: "quickbooks",
  billingModel: "hybrid",
  salesTaxNexusStates: 8,
  financeTeam: {
    controller: "none",
    strategicFinance: "none",
    financeOperations: "fractional",
    tax: "outsourced",
    treasury: "none",
    staffAccountants: 1,
  },
});

describe("permissions", () => {
  it("keeps membership administration with the CFO admin", () => {
    expect(can("cfo-admin", "members:manage")).toBe(true);
    expect(can("finance-editor", "members:manage")).toBe(false);
    expect(can("viewer", "tasks:edit")).toBe(false);
  });
});

describe("tailoring", () => {
  it("evaluates nested company conditions", () => {
    expect(
      evaluateCondition(profile, {
        field: "financeTeam.controller",
        operator: "equals",
        value: "none",
      }),
    ).toBe(true);
    expect(
      evaluateCondition(profile, {
        field: "businessModels",
        operator: "contains",
        value: "consumer-subscription",
      }),
    ).toBe(false);
  });

  it("schedules only matching tasks", () => {
    const tasks: MasterTask[] = [
      {
        id: "hire-controller",
        workstream: "leadership",
        phase: "days-1-30",
        title: "Open the Controller search",
        description: "Create the scorecard and launch the Controller search.",
        outcome: "Controller search is active.",
        priority: "critical",
        startOffsetDays: 1,
        durationDays: 14,
        ownerRole: "CFO",
        financeResponsibility: "owns",
        dependencies: [],
        conditions: [
          {
            field: "financeTeam.controller",
            operator: "not-equals",
            value: "full-time",
          },
        ],
        recommendationReason: "No full-time Controller is in place.",
        evidence: ["Approved scorecard"],
        deliverables: ["Controller scorecard"],
        tags: ["hiring"],
        cadence: null,
        sourceUrls: [],
      },
    ];

    const [task] = generateRoadmap(profile, tasks);
    expect(task?.startDate).toBe("2026-09-02");
    expect(task?.endDate).toBe("2026-09-15");
  });
});

describe("dependency state", () => {
  it("marks a task blocked until every dependency is complete", () => {
    const blocked = blockedTaskIds(
      [
        { id: "a", dependencies: [] },
        { id: "b", dependencies: ["a"] },
      ],
      new Set(),
    );
    expect(blocked.has("b")).toBe(true);
    expect(blocked.has("a")).toBe(false);
  });
});
