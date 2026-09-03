"use client";

import { Button } from "@cfo/ui";
import { LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState(
    process.env.NODE_ENV === "production" ? "" : "cfo@example.com",
  );
  const [password, setPassword] = useState(
    process.env.NODE_ENV === "production" ? "" : "local-demo-only",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/app",
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="mb-7 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--purple)] text-white">
          <Sparkles size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--purple)]">
            Startup CFO OS
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Sign in to your finance workspace
          </h1>
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
          Email
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field"
          required
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        <LockKeyhole size={16} aria-hidden="true" />
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-xs leading-5 text-[var(--ink-muted)]">
        Local mode stores data on this machine. No cloud account or subscription
        is connected.
      </p>
    </form>
  );
}
