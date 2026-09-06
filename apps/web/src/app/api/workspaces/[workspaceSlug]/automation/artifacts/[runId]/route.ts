import { getAgentArtifact } from "@cfo/db";
import { artifactToCsv, artifactToMarkdown } from "@cfo/automation";
import { automationAccess } from "@/lib/automation-api";
import { createAgentPresentation } from "@/lib/agent-presentation";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ workspaceSlug: string; runId: string }> }) {
  const { workspaceSlug, runId } = await context.params;
  const access = await automationAccess(workspaceSlug);
  if (access.response) return access.response;
  const format = new URL(request.url).searchParams.get("format") ?? "md";
  if (!["md", "csv", "pptx"].includes(format)) return Response.json({ error: "Choose md, csv or pptx." }, { status: 400 });
  let artifact;
  try {
    artifact = await getAgentArtifact(access.userId, access.workspace.id, runId);
  } catch (error) {
    if (error instanceof Error && error.message === "Agent output not found.") {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
  if (format === "pptx" && !artifact.slides.length) return Response.json({ error: "This result has no presentation." }, { status: 409 });
  const content = format === "pptx"
    ? await createAgentPresentation(artifact)
    : format === "csv" ? artifactToCsv(artifact) : artifactToMarkdown(artifact);
  const filename = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  const body = typeof content === "string" ? content : new Uint8Array(content).buffer;
  return new Response(body, {
    headers: {
      "content-type": format === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.${format}"`,
      "cache-control": "no-store",
    },
  });
}
