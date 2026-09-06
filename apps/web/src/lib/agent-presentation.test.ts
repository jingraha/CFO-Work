import { describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { AgentArtifact } from "@cfo/domain";

vi.mock("server-only", () => ({}));
import { createAgentPresentation } from "./agent-presentation";

describe("agent presentation", () => {
  it("creates an editable widescreen PowerPoint package with slides, notes and escaped text", async () => {
    const artifact: AgentArtifact = {
      title: 'Cash & runway <review>',
      summary: "Synthetic analysis, not a live forecast.",
      contract: {
        title: "Cash", deliverables: ["Cash analysis"], acceptanceCriteria: ["Reconcile cash"],
        requiredSystems: ["banking"], requiresHumanApproval: false,
      },
      sections: [], sources: [], checks: [],
      recommendations: [], limitations: ["Synthetic records only."],
      slides: [{ title: "Cash position", bullets: ["$1,000 in the bank", "Review AR & AP"], speakerNotes: "Discuss the assumptions." }],
    };
    const bytes = await createAgentPresentation(artifact);
    const entries = unzipSync(bytes);
    expect(entries["[Content_Types].xml"]).toBeDefined();
    expect(Object.keys(entries).filter((key) => /^ppt\/slides\/slide\d+\.xml$/.test(key))).toHaveLength(2);
    const presentation = strFromU8(entries["ppt/presentation.xml"]!);
    expect(presentation).toContain('cx="12192000" cy="6858000"');
    expect(presentation.match(/<p:sldId /g)).toHaveLength(2);
    expect(strFromU8(entries["ppt/slides/slide1.xml"]!)).toContain("Cash &amp; runway &lt;review&gt;");
    expect(strFromU8(entries["ppt/notesSlides/notesSlide2.xml"]!)).toContain("Discuss the assumptions.");
    const rels = strFromU8(entries["ppt/slides/_rels/slide1.xml.rels"]!);
    expect(rels).toContain("notesSlide");
    expect(rels).toContain("slideLayout");
    expect(Object.keys(entries).some((key) => key.includes("vbaProject"))).toBe(false);
  });
});
