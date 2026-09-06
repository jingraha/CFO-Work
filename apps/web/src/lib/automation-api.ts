import "server-only";
import { listUserWorkspaces } from "@cfo/db";
import { headers } from "next/headers";

export async function automationAccess(slug: string) {
  const { auth } = await import("./auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspace = workspaces.find((item) => item.slug === slug);
  if (!workspace) return { response: Response.json({ error: "Workspace not found." }, { status: 404 }) };
  return { userId: session.user.id, workspace };
}
