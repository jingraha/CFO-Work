import type { Playbook } from "@cfo/domain";
import { cite, section, text, type EvidenceContext } from "./evidence";
import type { Report } from "./reports";

export function transcriptReport(context: EvidenceContext, book: Playbook): Report {
  const evidence = context.records.filter((row) =>
    ["meeting-transcript", "assessment-note"].includes(row.record.kind) &&
    row.record.data.taskId === context.input.taskId && text(row, "text").trim().length >= 40);
  if (!evidence.length) throw new Error("Add meeting transcript text or assessment notes to this task before running the team assessment.");
  const themes = [
    { name: "Workload and capacity", pattern: /\b(workload|capacity|overload|hours|bandwidth|manual|time|understaff)/i },
    { name: "Ownership and coverage", pattern: /\b(owner|responsib|handoff|cover|accountab|backup|role)/i },
    { name: "Skills and support", pattern: /\b(skill|train|learn|experience|support|gap|hire|help)/i },
  ];
  const quotes = evidence.flatMap((row) => {
    const passages = text(row, "text").split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    return passages.flatMap((passage) => {
      const matches = themes.filter((theme) => theme.pattern.test(passage));
      return (matches.length ? matches : [{ name: "Context to review" }]).map((theme) => ({
        theme: theme.name, quote: passage, source: row,
      }));
    });
  });
  return {
    summary: `${evidence.length} evidence records support ${quotes.length} quoted observations for manager review.`,
    sections: [
      section(book.contract.deliverables[0]!, "Only evidence supplied for this task is included.", ["Evidence", "Type", "Characters", "Source"],
        evidence.map((row) => [row.record.title, row.record.kind, text(row, "text").length, cite(row)])),
      section(book.contract.deliverables[1]!, "Themes are keyword-assisted groupings of exact quotes, not inferred employee ratings.", ["Theme", "Supporting quote", "Source"],
        quotes.map((item) => [item.theme, item.quote, cite(item.source)])),
      section(book.contract.deliverables[2]!, "Confirm the statements with the team before making staffing decisions.", ["Topic", "Follow-up question"],
        [
          ["Capacity", "Which recurring activities need more capacity, and how many hours do they require?"],
          ["Ownership", "Who owns each activity, and who provides backup coverage?"],
          ["Skills", "Which gaps need training, reassignment, or an approved hiring plan?"],
        ]),
    ],
    checks: [
      { name: book.contract.acceptanceCriteria[3]!, passed: quotes.length > 0 && quotes.every((item) => text(item.source, "text").includes(item.quote)), detail: `${quotes.length} observations are exact source passages.` },
      { name: book.contract.acceptanceCriteria[4]!, passed: evidence.every((row) => quotes.some((item) => item.source.record.id === row.record.id)), detail: `${evidence.length} task-specific records represented.` },
    ],
    recommendations: ["Review the quoted themes with team leaders.", "Confirm ownership and workload before hiring or changing roles."],
    limitations: ["No employee performance, personality, or likelihood-of-departure scores are inferred.", "Text analysis is local and deterministic. It is a draft for human review, not a completed listening tour or staffing decision."],
  };
}
