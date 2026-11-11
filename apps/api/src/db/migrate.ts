import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { loadEnv } from "../env";

export function sqlDirectory(): string {
  const candidates = [
    path.resolve(__dirname, "../../sql"),
    path.resolve(__dirname, "../sql"),
    path.resolve(process.cwd(), "sql"),
    path.resolve(process.cwd(), "apps/api/sql"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Could not find the SQL migration directory.");
  }
  return found;
}

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = readdirSync(sqlDirectory())
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
    if (existing.rowCount) continue;
    const sql = readFileSync(path.join(sqlDirectory(), file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function sslFor(url: string): false | { rejectUnauthorized: boolean } | undefined {
  if (/sslmode=disable/.test(url)) return false;
  if (/localhost|127\.0\.0\.1/.test(url) && !/sslmode=require/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  const pool = new Pool({ connectionString: url, ssl: sslFor(url), max: 2 });
  try {
    await migrate(pool);
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Migration failed.";
    console.error(message);
    process.exit(1);
  });
}
