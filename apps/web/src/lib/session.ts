import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requireSession() {
  const { auth } = await import("./auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session;
}
