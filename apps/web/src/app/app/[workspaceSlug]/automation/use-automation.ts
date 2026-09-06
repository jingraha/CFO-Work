"use client";

import { can, type AutomationSnapshot } from "@cfo/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import type { ExecuteAction } from "./environment-ui";

export function useAutomation(data: WorkspaceViewData, onTasksChanged: () => void) {
  const [snapshot, setSnapshot] = useState<AutomationSnapshot | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const version = useRef<string | null>(null);
  const changed = useRef(onTasksChanged);
  useEffect(() => { changed.current = onTasksChanged; }, [onTasksChanged]);
  const editable = can(data.workspace.role, "workspace:edit");
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(data.workspace.slug)}/automation`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to load agent status." : "Agent status could not be loaded. Try Refresh.");
      const next: AutomationSnapshot = await response.json();
      if (!mounted.current || controller.signal.aborted) return;
      setSnapshot(next);
      setError("");
      const nextVersion = JSON.stringify(next.runs.map((run) => [run.id, run.status, run.updatedAt]));
      if (version.current !== null && version.current !== nextVersion) changed.current();
      version.current = nextVersion;
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : "Agent status could not be loaded.");
    }
  }, [data.workspace.slug]);
  useEffect(() => {
    mounted.current = true;
    const start = setTimeout(() => void refresh(), 0);
    return () => { mounted.current = false; clearTimeout(start); request.current?.abort(); };
  }, [refresh]);
  useEffect(() => {
    if (!snapshot?.enabled) return;
    const timer = setInterval(() => { if (!mutation.current) void refresh(); }, 3000);
    return () => clearInterval(timer);
  }, [snapshot?.enabled, refresh]);

  const execute: ExecuteAction = async (key, operation, affectsTasks = true) => {
    if (mutation.current) return false;
    if (!editable) { setError("A finance editor or CFO admin must make this change."); return false; }
    mutation.current = true;
    setPending(key);
    setError("");
    try {
      await operation();
      if (affectsTasks) changed.current();
      await refresh();
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "The change could not be saved.");
      return false;
    } finally {
      mutation.current = false;
      if (mounted.current) setPending("");
    }
  };
  return { snapshot, error, pending, busy: !!pending, editable,
    base: { workspaceId: data.workspace.id, workspaceSlug: data.workspace.slug }, execute, refresh };
}

export type AutomationController = ReturnType<typeof useAutomation>;
