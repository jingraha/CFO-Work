import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDatabase, schema } from "@cfo/db";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

const isProduction = process.env.NODE_ENV === "production";
const secret =
  process.env.BETTER_AUTH_SECRET ??
  (isProduction && process.env.CFO_BUILD_ONLY !== "true"
    ? undefined
    : "local-only-cfo-os-development-secret-change-before-production");

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

const database = await getDatabase();

export const auth = betterAuth({
  appName: "Startup CFO OS",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret,
  database: drizzleAdapter(database, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    disableSignUp: process.env.CFO_ALLOW_SIGNUP !== "true",
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory",
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 8,
      },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
    database: {
      joins: false,
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
