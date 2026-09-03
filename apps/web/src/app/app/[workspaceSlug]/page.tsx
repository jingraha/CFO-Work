import {
  hiringRoles,
  masterTasks,
  templates,
  vendors,
  workstreams,
} from "@cfo/catalog";
import { getWorkspaceSnapshot } from "@cfo/db";
import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { serializeWorkspace } from "@/lib/workspace-data";
import { WorkspaceApp } from "./workspace-app";

export const metadata: Metadata = {
  title: "Finance workspace",
};

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const [{ workspaceSlug }, session] = await Promise.all([
    params,
    requireSession(),
  ]);
  const snapshot = await getWorkspaceSnapshot(session.user.id, workspaceSlug);

  return (
    <WorkspaceApp
      initialData={serializeWorkspace(snapshot)}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
      catalog={{
        workstreams,
        masterTasks,
        hiringRoles,
        vendors,
        templates,
      }}
    />
  );
}
