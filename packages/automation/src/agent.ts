import {
  AgentArtifactSchema,
  type AgentArtifact, type AgentExecutionInput, type ArtifactCheck, type ArtifactSection,
} from "@cfo/domain";
import { createContext, sourceCitation } from "./evidence";
import { COMMON_CRITERIA, skills } from "./playbooks";
import { reportBuilders } from "./reports";
import { validateExceptionCoverage } from "./quality";
import { DEMO_AS_OF_DATE } from "./systems";
import { transcriptReport } from "./transcript-report";

const LOCAL_IDENTITY = "Deterministic local demo agent (rule-based; no live LLM inference).";

const cloneContract = (contract: AgentArtifact["contract"]): AgentArtifact["contract"] => ({
  ...contract,
  deliverables: [...contract.deliverables],
  requiredSystems: [...contract.requiredSystems],
  acceptanceCriteria: [...contract.acceptanceCriteria],
});

/** Runs pure, read-only recipes against connected in-memory records. */
export function executePlaybook(playbookId: string, input: AgentExecutionInput): AgentArtifact {
  const book = skills.find((candidate) => candidate.id === playbookId);
  if (!book) throw new Error(`Unsupported local playbook: ${String(playbookId)}.`);
  const context = createContext(input, book);
  if (book.id === "team-assessment") {
    context.records = context.records.filter((row) =>
      ["meeting-transcript", "assessment-note"].includes(row.record.kind) && row.record.data.taskId === input.taskId);
    context.sources = context.records.map(({ system, record }) => ({
      systemId: system.id, recordId: record.id, title: record.title, revision: system.revision,
    }));
  }
  const report = book.id === "team-assessment" ? transcriptReport(context, book) : reportBuilders[book.id]!(context, book);
  const recipeChecks = [...report.checks, ...validateExceptionCoverage(context, book, report.sections)];
  const sources = [...context.sources];
  const missingDeliverables = book.contract.deliverables.filter((deliverable) => !report.sections.some((part) =>
    part.title === deliverable && part.body.trim() && part.columns.length > 0 && part.rows.length > 0
    && part.rows.every((row) => row.length === part.columns.length)));
  const staleSources = sources.filter((source) => !context.sources.some((current) =>
    current.systemId === source.systemId && current.recordId === source.recordId && current.revision === source.revision && current.title === source.title));
  const numericCells = report.sections.flatMap((part) => part.rows.flat()).filter((cell): cell is number => typeof cell === "number");
  const checks: ArtifactCheck[] = [
    { name: COMMON_CRITERIA[0], passed: missingDeliverables.length === 0, detail: missingDeliverables.length ? `Missing or malformed sections: ${missingDeliverables.join(", ")}.` : `${book.contract.deliverables.length} populated deliverable sections; each row matches its declared columns.` },
    { name: COMMON_CRITERIA[1], passed: sources.length > 0 && staleSources.length === 0, detail: `${sources.length - staleSources.length}/${sources.length} source citations resolve at current revisions.${staleSources.length ? ` Stale/unresolved: ${staleSources.map(sourceCitation).join("; ")}` : ""}` },
    { name: COMMON_CRITERIA[2], passed: numericCells.length > 0 && numericCells.every(Number.isFinite), detail: `${numericCells.length} numeric table cells checked; zero-denominator metrics use explicit text instead of Infinity or NaN.` },
    ...book.contract.acceptanceCriteria.slice(3).map((name) => recipeChecks.find((check) => check.name === name)
      ?? { name, passed: false, detail: "No independent validator produced this required report-quality check." }),
  ];
  const failed = checks.filter((item) => !item.passed);
  const limitations = [
    LOCAL_IDENTITY,
    `Synthetic USD records as of ${DEMO_AS_OF_DATE}; no cloud, network, paid API, live company account, or external action is used.`,
    "Acceptance completes only the local assessment or draft. Business risks remain unresolved; no payments, journals, book closing, hiring, policy approval, or board decisions are executed.",
    "Report-quality checks validate source integrity, arithmetic, and exception coverage. A passed check is not evidence of a healthy business or remediated controls.",
    ...(book.contract.requiresHumanApproval ? ["Human approval is required. This artifact does not authorize payments, journals, a close, hiring, policy changes, or board decisions."] : []),
    ...report.limitations,
  ];
  const metricSection = report.sections.find((part) => part.rows.some((row) => row.some((cell) => typeof cell === "number")))!;
  const supportingSection = report.sections[1] ?? metricSection;
  const summarizeRows = (part: ArtifactSection) => part.rows.slice(0, 4).map((row) =>
    row.map((cell, index) => `${part.columns[index]}: ${String(cell)}`).join(" | "));
  const sourceNotes = sources.slice(0, 5).map(sourceCitation).join("; ");
  const artifact: AgentArtifact = {
    title: `${book.title} — ${input.profile.name}`,
    summary: `${LOCAL_IDENTITY} Diagnostic produced; ${failed.length} report-quality acceptance checks need review. ${report.summary}`,
    contract: cloneContract(book.contract),
    sections: report.sections,
    sources,
    checks,
    recommendations: report.recommendations,
    limitations,
    slides: [
      {
        title: "Local diagnostic and scope",
        bullets: [book.title, report.summary, `Source snapshot: ${DEMO_AS_OF_DATE}. Required systems: ${book.contract.requiredSystems.join(", ")}.`],
        speakerNotes: `${LOCAL_IDENTITY} Read the report as a draft, not evidence of external execution. ${sourceNotes}`,
      },
      {
        title: metricSection.title,
        bullets: summarizeRows(metricSection),
        speakerNotes: `${metricSection.body} Reported values are calculated from source records. ${sourceNotes}`,
      },
      {
        title: supportingSection.title,
        bullets: summarizeRows(supportingSection),
        speakerNotes: `${supportingSection.body} Review period, assumptions, and record revisions before accepting the conclusion. ${sourceNotes}`,
      },
      {
        title: "Report quality and unresolved business risks",
        bullets: [
          `${checks.length - failed.length}/${checks.length} report-quality checks passed. This does not resolve observed business risks.`,
          ...failed.slice(0, 2).map((item) => `QUALITY REVIEW: ${item.name} ${item.detail}`),
          ...report.recommendations.slice(0, 3),
        ],
        speakerNotes: `Source, structural, or arithmetic failures block report acceptance. Complete reporting of duplicates, missing owners, or negative cash does not. Proposed remediation and operational approvals remain human work. ${sourceNotes}`,
      },
      {
        title: "Human review and next actions",
        bullets: [...report.recommendations.slice(0, 4), book.contract.requiresHumanApproval ? "Human approval required; no external action taken." : "Review proposed follow-ups; no external action taken."],
        speakerNotes: `${limitations.join(" ")} Acceptance, assignment, and any external execution remain separate steps. ${sourceNotes}`,
      },
    ],
  };
  return AgentArtifactSchema.parse(artifact);
}

function describeRows(part: ArtifactSection, query: string): string {
  const keywords = query.match(/\b(cash|runway|burn|receipts|payments|payroll|headcount|revenue|expense|overdue|total|variance)\b/g) ?? [];
  const requestedWeek = query.match(/\bweek\s+(\d{1,2})\b/);
  const score = (row: ArtifactSection["rows"][number]) => {
    const label = String(row[0]).toLowerCase();
    return keywords.filter((keyword) => label.includes(keyword)).length
      + (requestedWeek && part.columns[0] === "Week" && row[0] === Number(requestedWeek[1]) ? 10 : 0);
  };
  const rows = [...part.rows].sort((left, right) => score(right) - score(left)).slice(0, 6);
  return `${part.title}: ${part.body}\n${rows.map((row) => row.map((cell, index) => `${part.columns[index]}: ${cell}`).join(" | ")).join("\n")}${part.rows.length > 6 ? `\nShowing 6 relevant rows of ${part.rows.length}; see the full section for the rest.` : ""}`;
}

/** Evidence retrieval by explicit keyword rules, not generated inference. */
export function answerReviewQuestion(artifact: AgentArtifact, question: string): string {
  AgentArtifactSchema.parse(artifact);
  if (typeof question !== "string" || !question.trim() || question.length > 2000) {
    throw new Error("Provide a review question between 1 and 2000 characters.");
  }
  const query = question.toLowerCase();
  const insufficient = `${LOCAL_IDENTITY} Insufficient evidence in this artifact to answer that question. Ask about its reported numbers, cash, risks, checks, actions, or cited sources. I cannot infer unrelated facts or execute requests.`;
  const requestedWeek = query.match(/\bweek\s+(\d+)\b/);
  const requestedYears = query.match(/\b20\d{2}\b/g) ?? [];
  if ((requestedWeek && (Number(requestedWeek[1]) < 1 || Number(requestedWeek[1]) > 13))
    || requestedYears.some((year) => year !== "2026")) return insufficient;
  if (/\b(weather|stock price|share price|competitor|internet|password|credential|secret|tomorrow['’]?s|send|transfer|execute|approve|hire|fire)\b/.test(query)) return insufficient;
  if (/\b(source|sources|evidence|provenance|citation|citations|revision|revisions|where)\b/.test(query)) {
    return `${LOCAL_IDENTITY} The report cites ${artifact.sources.length} source records. First ${Math.min(12, artifact.sources.length)}:\n${artifact.sources.slice(0, 12).map(sourceCitation).join("\n")}\nSource revisions are local snapshot versions, not live-system attestations.`;
  }
  if (/\b(check|checks|valid|validation|acceptance|pass|passed|fail|failed|reconcil\w*)\b/.test(query)) {
    return `${LOCAL_IDENTITY}\n${artifact.checks.map((item) => `${item.passed ? "PASS" : "NEEDS REVIEW"}: ${item.name} ${item.detail}`).join("\n")}`;
  }
  if (/\b(risk|risks|warning|warnings|issue|issues|duplicate|duplicates|exception|exceptions|blocker|blockers)\b/.test(query)) {
    const failed = artifact.checks.filter((item) => !item.passed);
    const riskSections = artifact.sections.filter((part) => /exceptions|readiness|queue|controls register|decisions|risk evidence/i.test(part.title));
    return `${LOCAL_IDENTITY}\nReport quality: ${failed.length ? failed.map((item) => `${item.name} ${item.detail}`).join("\n") : "All recorded quality checks passed; this does not mean business risks are resolved."}\nObserved findings:\n${riskSections.slice(0, 2).map((part) => describeRows(part, query)).join("\n\n") || artifact.summary}\nProposed responses (not executed):\n${artifact.recommendations.join("\n")}\nLimitations: ${artifact.limitations.join(" ")}`;
  }
  if (/\b(action|actions|next|recommend\w*|owner|owners|decision|decisions)\b/.test(query)) {
    return `${LOCAL_IDENTITY} Proposed actions (not executed):\n${artifact.recommendations.join("\n")}\nHuman approval required by this contract: ${artifact.contract.requiresHumanApproval ? "yes" : "no; external actions still are not executed"}.`;
  }
  const patterns = [
    { question: /\b(cash|runway|burn|liquidity|forecast)\b/, section: /\b(cash|runway|burn|projection|financial baseline|financial scorecard)\b/i },
    { question: /\b(ar|receivable\w*|collection\w*|aging|overdue)\b/, section: /\b(invoice aging|aging reconciliation|collections|working capital|financial baseline|financial scorecard)\b/i },
    { question: /\b(ap|payable\w*|payment\w*)\b/, section: /\b(payables|duplicate invoice|payment review|working capital|financial baseline|financial scorecard)\b/i },
    { question: /\b(payroll|salary|salaries|headcount|workforce|employees)\b/, section: /\b(workforce|payroll|financial baseline|financial scorecard)\b/i },
    { question: /\b(budget|variance|expense|revenue)\b/, section: /\b(variance|budget|expense|trial balance)\b/i },
    { question: /\b(number|numbers|metric|metrics|total|totals|summary|summari\w*)\b/, section: /./ },
  ];
  const rule = patterns.find((candidate) => candidate.question.test(query));
  if (rule) {
    const matches = artifact.sections.filter((part) => rule.section.test(part.title) && part.rows.some((row) => row.some((cell) => typeof cell === "number")));
    if (!matches.length) return insufficient;
    return `${LOCAL_IDENTITY} These are reported values, not additional predictions:\n${matches.slice(0, 2).map((part) => describeRows(part, query)).join("\n\n")}`;
  }
  if (/\b(llm|model|agent|local|live|limitation|limitations|assumption|assumptions)\b/.test(query)) {
    return `${LOCAL_IDENTITY}\n${artifact.limitations.join("\n")}`;
  }
  return insufficient;
}

const markdownText = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replace(/([\\`*_{}[\]()#!|])/g, "\\$1").replace(/\r\n|\r|\n/g, "<br>");

export function artifactToMarkdown(artifact: AgentArtifact): string {
  AgentArtifactSchema.parse(artifact);
  const lines = [
    `# ${markdownText(artifact.title)}`, "", markdownText(artifact.summary), "",
    "## Output contract", "",
    `**Title:** ${markdownText(artifact.contract.title)}`,
    `**Required systems:** ${artifact.contract.requiredSystems.map(markdownText).join(", ")}`,
    `**Human approval required:** ${artifact.contract.requiresHumanApproval ? "Yes" : "No"}`, "",
    "### Deliverables", ...artifact.contract.deliverables.map((value) => `- ${markdownText(value)}`), "",
    "### Acceptance criteria", ...artifact.contract.acceptanceCriteria.map((value) => `- ${markdownText(value)}`),
  ];
  for (const part of artifact.sections) {
    lines.push("", `## ${markdownText(part.title)}`, "", markdownText(part.body), "");
    if (part.columns.length) {
      lines.push(`| ${part.columns.map(markdownText).join(" | ")} |`, `| ${part.columns.map(() => "---").join(" | ")} |`,
        ...part.rows.map((row) => `| ${row.map(markdownText).join(" | ")} |`));
    }
  }
  lines.push("", "## Acceptance validation", ...artifact.checks.map((item) => `- **${item.passed ? "PASS" : "NEEDS REVIEW"}:** ${markdownText(item.name)} ${markdownText(item.detail)}`),
    "", "## Proposed actions", ...artifact.recommendations.map((value) => `- ${markdownText(value)}`),
    "", "## Limitations", ...artifact.limitations.map((value) => `- ${markdownText(value)}`),
    "", "## Source records", ...artifact.sources.map((source) => `- ${markdownText(sourceCitation(source))}`),
    "", "## Review slides");
  artifact.slides.forEach((slide, index) => {
    lines.push("", `### ${index + 1}. ${markdownText(slide.title)}`, ...slide.bullets.map((value) => `- ${markdownText(value)}`),
      "", `**Speaker notes:** ${markdownText(slide.speakerNotes)}`);
  });
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Leading whitespace/control characters must not conceal spreadsheet formulas.
  if (typeof value === "string" && (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** A normalized, rectangular CSV: one report cell per row, including sources/checks. */
export function artifactToCsv(artifact: AgentArtifact): string {
  AgentArtifactSchema.parse(artifact);
  const rows: Array<Array<string | number>> = [["type", "section", "row", "field", "value"]];
  const add = (type: string, section: string, row: number, field: string, value: string | number) => rows.push([type, section, row, field, value]);
  add("artifact", "Metadata", 0, "title", artifact.title);
  add("artifact", "Metadata", 0, "summary", artifact.summary);
  add("contract", "Output contract", 0, "title", artifact.contract.title);
  add("contract", "Output contract", 0, "requiresHumanApproval", String(artifact.contract.requiresHumanApproval));
  artifact.contract.requiredSystems.forEach((value, index) => add("contract", "Required systems", index + 1, "system", value));
  artifact.contract.deliverables.forEach((value, index) => add("contract", "Deliverables", index + 1, "deliverable", value));
  artifact.contract.acceptanceCriteria.forEach((value, index) => add("contract", "Acceptance criteria", index + 1, "criterion", value));
  artifact.sections.forEach((part) => {
    add("section", part.title, 0, "body", part.body);
    part.rows.forEach((row, index) => row.forEach((cell, column) => add("data", part.title, index + 1, part.columns[column] ?? `column-${column + 1}`, cell)));
  });
  artifact.checks.forEach((item, index) => {
    add("check", "Acceptance validation", index + 1, "name", item.name);
    add("check", "Acceptance validation", index + 1, "passed", String(item.passed));
    add("check", "Acceptance validation", index + 1, "detail", item.detail);
  });
  artifact.recommendations.forEach((value, index) => add("recommendation", "Proposed actions", index + 1, "action", value));
  artifact.limitations.forEach((value, index) => add("limitation", "Limitations", index + 1, "limitation", value));
  artifact.sources.forEach((source, index) => {
    for (const [field, value] of Object.entries(source)) add("source", "Source records", index + 1, field, value);
  });
  artifact.slides.forEach((slide, index) => {
    add("slide", slide.title, index + 1, "speakerNotes", slide.speakerNotes);
    slide.bullets.forEach((value) => add("slide", slide.title, index + 1, "bullet", value));
  });
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
