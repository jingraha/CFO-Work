import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/app");

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface)] px-5 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-xl shadow-slate-200/60 md:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[620px] bg-[var(--ink)] p-12 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
              Incoming CFO command center
            </p>
            <h2 className="mt-7 max-w-lg text-4xl font-semibold leading-tight tracking-tight">
              Stabilize the close. Build the team. Extend runway. Scale with
              control.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              One operating system for the first 90 days, the first year, and
              every recurring finance cadence after it.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--blue)]">10</strong>
              workstreams
            </div>
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--pink)]">4</strong>
              operating models
            </div>
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--teal)]">$0</strong>
              local cost
            </div>
          </div>
        </section>
        <section className="flex items-center p-7 sm:p-12">
          <div className="w-full">
            <SignInForm />
          </div>
        </section>
      </div>
    </main>
  );
}
