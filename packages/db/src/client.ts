import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrations } from "./migrations";
import { schema } from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalDatabase = globalThis as typeof globalThis & {
  cfoPglite?: PGlite;
  cfoDatabase?: Database;
  cfoDatabaseInit?: Promise<Database>;
};

function localDataDirectory(): string {
  const configured = process.env.CFO_DATABASE_PATH;
  if (configured) return path.resolve(configured);
  const normalized = process.cwd().replaceAll("\\", "/");
  const root = normalized.endsWith("/apps/web")
    ? path.resolve(process.cwd(), "..", "..")
    : process.cwd();
  return path.resolve(root, ".data", "cfo-os");
}

async function applyMigrations(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const migration of migrations) {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM schema_migration WHERE id = $1",
      [migration.id],
    );
    if (result.rows.length > 0) continue;
    await client.transaction(async (transaction) => {
      await transaction.exec(migration.sql);
      await transaction.query(
        "INSERT INTO schema_migration (id) VALUES ($1)",
        [migration.id],
      );
    });
  }
}

export async function getDatabase(): Promise<Database> {
  globalDatabase.cfoDatabaseInit ??= (async () => {
    const directory = localDataDirectory();
    await mkdir(path.dirname(directory), { recursive: true });
    const client = new PGlite(directory);
    const database = drizzle({
      client,
      schema,
    });
    await applyMigrations(client);
    globalDatabase.cfoPglite = client;
    globalDatabase.cfoDatabase = database;
    return database;
  })().catch((error: unknown) => {
    delete globalDatabase.cfoDatabaseInit;
    throw error;
  });
  return globalDatabase.cfoDatabaseInit;
}

export async function closeDatabase(): Promise<void> {
  if (globalDatabase.cfoDatabaseInit) {
    await globalDatabase.cfoDatabaseInit;
  }
  if (!globalDatabase.cfoPglite) return;
  await globalDatabase.cfoPglite.close();
  delete globalDatabase.cfoPglite;
  delete globalDatabase.cfoDatabase;
  delete globalDatabase.cfoDatabaseInit;
}
