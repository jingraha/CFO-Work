import { getAutomationSnapshot } from "@cfo/db";
import { automationAccess } from "@/lib/automation-api";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await context.params;
  const access = await automationAccess(workspaceSlug);
  if (access.response) return access.response;
  return Response.json(await getAutomationSnapshot(access.userId, access.workspace.id), {
    headers: { "cache-control": "no-store" },
  });
}
