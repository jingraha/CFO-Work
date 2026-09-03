export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const { auth } = await import("@/lib/auth");
  return auth.handler(request);
}

export { handler as GET, handler as POST };
