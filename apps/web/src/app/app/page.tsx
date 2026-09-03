import { listUserWorkspaces } from "@cfo/db";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppEntryPage() {
  const session = await requireSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  if (workspaces[0]) redirect(`/app/${workspaces[0].slug}`);
  redirect("/app/new");
}
