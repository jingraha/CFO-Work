import { exportWorkspace } from "@cfo/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { workspaceSlug } = await params;
  const payload = await exportWorkspace(session.user.id, workspaceSlug);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${workspaceSlug}-cfo-workspace.json"`,
      "cache-control": "no-store",
    },
  });
}
