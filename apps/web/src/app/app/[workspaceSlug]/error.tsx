"use client";

import { Button, Card } from "@cfo/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface)] p-5">
      <Card className="max-w-lg p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-700">
          <AlertTriangle size={21} />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          The workspace could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {error.message ||
            "The local database returned an unexpected error. No changes were made."}
        </p>
        <Button className="mt-5" onClick={reset}>
          <RefreshCw size={14} /> Try again
        </Button>
      </Card>
    </main>
  );
}
