import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = {
  title: "Create workspace",
};

export const dynamic = "force-dynamic";

export default async function NewWorkspacePage() {
  await requireSession();
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-10">
      <OnboardingWizard />
    </main>
  );
}
