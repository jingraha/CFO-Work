import { SYSTEM_IDS, type OutputContract, type Playbook, type SystemId, type WorkstreamKey } from "@cfo/domain";

export const COMMON_CRITERIA = [
  "Every deliverable has a populated report section.",
  "Every citation resolves to a connected source record at its input revision.",
  "Every reported number is finite.",
] as const;

function recipe(
  id: string, title: string, workstream: WorkstreamKey, description: string, dependsOn: string[],
  requiredSystems: SystemId[], deliverables: string[], criteria: string[], requiresHumanApproval = false,
): Playbook {
  return { id, title, workstream, description, dependsOn, contract: {
    title, deliverables, requiredSystems, acceptanceCriteria: [...COMMON_CRITERIA, ...criteria], requiresHumanApproval,
  } };
}

export const teamAssessmentSkill = recipe("team-assessment", "Draft a team assessment from transcripts", "leadership",
    "Extract source-backed workload, ownership, and capability themes from meeting transcripts or assessment notes. A human reviews the draft.",
    [], ["gmail"], ["Evidence inventory", "Team themes and supporting quotes", "Assessment follow-up questions"],
    ["Every quoted passage comes from provided task evidence.", "All supplied evidence records are represented."], true);

export const playbooks: Playbook[] = [
  recipe("system-inventory", "Inventory connected local finance systems", "finance-operations",
    "Read the eight local fixtures, count available records, and test shared entity references. No live system access is implied.",
    [], [...SYSTEM_IDS], ["System and data inventory", "Cross-system reference register", "Connection and data-quality actions"],
    ["All eight systems contain records.", "Every cross-system and entity reference resolves."]),
  recipe("stakeholder-context", "Assess stakeholder requests from local messages", "leadership",
    "Compare written stakeholder requests and channel messages. Produce an interview agenda, not a completed listening tour.",
    ["system-inventory"], ["gmail", "slack"],
    ["Stakeholder evidence map", "Themes and corroborating messages", "Stakeholder follow-up agenda"],
    ["All emails have a sender, request, and due date.", "All Slack messages reference an existing channel."]),
  recipe("close-assessment", "Assess trial balance and close readiness", "controllership",
    "Reconcile the trial balance, inspect close ownership and deadlines, and draft a close remediation queue. Never post journals or close books.",
    ["system-inventory"], ["erp", "ar", "ap", "banking"],
    ["Trial balance reconciliation", "Close task readiness", "Subledger tie-outs", "Close remediation queue"],
    ["Trial balance debits equal credits.", "Cash, AR, and AP reconcile to their trial balance accounts.",
      "Every unowned open close task is identified with an ownership action.",
      "Every close-target exception is identified with a scheduling action."]),
  recipe("ar-aging", "Analyze accounts receivable aging", "commercial-finance",
    "Age open balances at the fixed demo date, reconcile buckets, and rank collections. Do not send collection messages.",
    ["system-inventory"], ["ar"],
    ["Invoice aging detail", "Aging reconciliation", "Collections action queue"],
    ["Aging buckets reconcile to independently summed source balances.", "Every invoice references a customer.",
      "Every overdue invoice is classified with an owner or an explicit assignment action."]),
  recipe("ap-review", "Review AP duplicates and payment readiness", "finance-operations",
    "Identify possible duplicate supplier invoices and unapproved payments without changing balances or releasing funds.",
    ["system-inventory"], ["ap"],
    ["Payables detail", "Duplicate invoice exceptions", "Payment review queue"],
    ["Reported open payables reconcile without removing suspected duplicates.", "Every bill references a vendor.",
      "Every duplicate supplier invoice group is identified without changing source balances.",
      "Every open bill is classified for duplicate, bill, and vendor approval exceptions."]),
  recipe("cash-forecast", "Build the 13-week cash forecast", "treasury-capital",
    "Reconcile bank balances and project 13 weekly periods from observed August receipts and disbursements. No fund transfers or financing commitments.",
    ["ar-aging", "ap-review"], ["banking", "ar", "ap"],
    ["Cash and runway baseline", "13-week cash projection", "Working capital sensitivity", "Treasury action queue"],
    ["Bank opening balances plus recorded transactions equal ending balances.", "Weekly projections reconcile to the starting available cash.",
      "Every bank ownership exception is identified with an assignment action.",
      "Every negative available-cash period is identified in the treasury action queue."]),
  recipe("workforce-review", "Review workforce and operating expense", "people-equity",
    "Reconcile department staffing and loaded compensation to the profile, GL, and approved budget. No hiring or payroll approval is performed.",
    ["system-inventory"], ["payroll", "erp", "planning"],
    ["Department workforce baseline", "Payroll reconciliation", "Workforce and expense actions"],
    ["Department headcount reconciles to the company profile.", "Loaded payroll equals gross pay plus employer costs and ties to the GL.",
      "Each department gross pay agrees with headcount and annual salary.", "Payroll budget coverage exists for the accounting month."]),
  recipe("budget-variance", "Analyze monthly budget variance", "strategic-finance",
    "Compare same-month GL expenses and trial-balance revenue with category budgets. Missing budgets are exceptions, not zeros.",
    ["workforce-review", "close-assessment"], ["erp", "planning"],
    ["Monthly category variances", "Budget and actual reconciliation", "Budget owner action queue"],
    ["Each actual category has exactly one budget for the accounting month.", "Reported expense totals reconcile to GL entries.",
      "No budget-only or uncategorized actual categories are omitted."]),
  recipe("controls-register", "Draft a source-backed finance controls register", "risk-controls",
    "Compile observed cash, close, receivable, and payment exceptions and propose owners and tests. A draft is not a control certification.",
    ["close-assessment", "ar-aging", "ap-review", "cash-forecast"], ["erp", "ar", "ap", "banking"],
    ["Observed controls register", "Control testing plan", "Prioritized control decisions"],
    ["Every control finding references observed records.", "Every proposed control test has an owner and test method.",
      "Every independently detected control exception is represented in the register and decision queue."]),
  recipe("cfo-diagnostic", "Prepare the initial CFO diagnostic", "leadership",
    "Synthesize the prior local assessments and current source balances into a CFO review pack. Never infer completion of an audit or external work.",
    ["stakeholder-context", "close-assessment", "ar-aging", "ap-review", "cash-forecast", "workforce-review", "budget-variance", "controls-register"],
    [...SYSTEM_IDS], ["Financial baseline", "Prior assessment evidence", "Prioritized CFO decisions", "30-day review plan"],
    ["Every prerequisite assessment is supplied with current source revisions.", "The baseline reconciles to the source trial balance.",
      "Every supplied prerequisite diagnostic has passed its report-quality checks."]),
  recipe("board-review", "Prepare the local board review package", "governance-legal",
    "Prepare review materials from the CFO diagnostic and current sources. Board approval, publication, and meeting completion remain human work.",
    ["cfo-diagnostic"], [...SYSTEM_IDS],
    ["Board financial scorecard", "Diagnostic and risk evidence", "Board decision requests", "Board follow-up register"],
    ["Every prerequisite assessment is supplied with current source revisions.", "The board scorecard reconciles to current source balances.",
      "Every supplied prerequisite diagnostic has passed its report-quality checks."]),
];
export const skills = [...playbooks, teamAssessmentSkill];

const normalize = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();
const aliases: Record<string, string> = {
  "rebuild the burn and runway baseline": "cash-forecast",
  "stand up budget versus actual reporting": "budget-variance",
  "run monthly budget versus actual reviews": "budget-variance",
  "assess team skills, capacity, and retention risk": "team-assessment",
  "baseline the monthly close process": "close-assessment",
  "review every balance sheet account for support": "close-assessment",
  "build the collections strategy": "ar-aging",
};

export function findPlaybookForTask(taskTitle: string): Playbook | undefined {
  if (typeof taskTitle !== "string") return undefined;
  const title = normalize(taskTitle);
  return skills.find((book) => normalize(book.title) === title || book.id === aliases[title]);
}

type TaskOutputInput = { title: string; description: string; deliverables: string[]; workstream: string };

/** Assessment only: this contract never asserts that a roadmap task was executed. */
export function assessTaskOutput(task: TaskOutputInput): OutputContract {
  if (!task || typeof task.title !== "string" || !task.title.trim() || typeof task.description !== "string"
    || typeof task.workstream !== "string" || !Array.isArray(task.deliverables)
    || !task.deliverables.every((value) => typeof value === "string" && value.trim())) {
    throw new Error("Task assessment needs a title, description, workstream, and nonempty deliverable names.");
  }
  const matching = findPlaybookForTask(task.title);
  const deliverables = task.deliverables.length ? [...new Set(task.deliverables)] : [`Evidence-backed ${task.title} review document`];
  const byStream: Record<string, SystemId[]> = {
    leadership: ["gmail", "slack", "planning"], controllership: ["erp", "ar", "ap"],
    "strategic-finance": ["erp", "planning"], "commercial-finance": ["ar", "planning"],
    "finance-operations": ["erp", "ap"], "treasury-capital": ["banking", "ar", "ap"],
    tax: ["erp", "payroll"], "risk-controls": ["erp", "ap", "banking"],
    "people-equity": ["payroll", "planning"], "governance-legal": ["gmail"],
  };
  const text = `${task.title} ${task.description} ${deliverables.join(" ")}`;
  const approval = /\b(approv\w*|sign[\s-]?off|pay(?:ment|roll|s)?|clos(?:e|ing)|audit|hir\w*|terminat\w*|file|filing|tax|legal|equity|board|bank|fundrais\w*|financ\w*|policy|policies|compensation)\b/i.test(text);
  return {
    title: `Output assessment: ${task.title}`,
    deliverables,
    requiredSystems: [...(matching?.contract.requiredSystems ?? byStream[task.workstream] ?? [])],
    acceptanceCriteria: [
      ...deliverables.map((deliverable) => `Provide "${deliverable}" with dated evidence, a named owner, and a reviewer-verifiable result.`),
      "Reconcile all reported numbers to dated source records; state exclusions and unresolved exceptions.",
      "Record human review and required approvals separately from drafting the deliverable.",
      matching
        ? `Local recipe "${matching.id}" can draft a diagnostic; independently verify coverage of this task's full deliverables.`
        : "Assessment only: no execution recipe exists for this task; require evidence of actual work before completion.",
      "External meetings, filings, audits, hiring, payments, and approvals must not be reported complete from a local diagnostic.",
    ],
    requiresHumanApproval: Boolean(matching?.contract.requiresHumanApproval || approval),
  };
}
