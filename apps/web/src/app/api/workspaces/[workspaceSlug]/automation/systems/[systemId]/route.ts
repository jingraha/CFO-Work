import { getAutomationSnapshot } from "@cfo/db";
import { SystemIdSchema } from "@cfo/domain";
import { automationAccess } from "@/lib/automation-api";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ workspaceSlug: string; systemId: string }> }) {
  const { workspaceSlug, systemId } = await context.params;
  const access = await automationAccess(workspaceSlug);
  if (access.response) return access.response;
  const id = SystemIdSchema.safeParse(systemId);
  if (!id.success) return Response.json({ error: "Unknown mock system." }, { status: 404 });
  const snapshot = await getAutomationSnapshot(access.userId, access.workspace.id);
  const system = snapshot.systems.find((item) => item.id === id.data);
  if (!system) return Response.json({ error: "Initialize the demo environment first." }, { status: 404 });
  return Response.json({ mode: "mock", system }, { headers: { "cache-control": "no-store" } });
}
