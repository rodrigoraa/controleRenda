import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
// PostgreSQL DATE values are calendar dates, not timezone-dependent instants.
pg.types.setTypeParser(1082, (value) => value);
export function createPool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    application_name: "controle-renda",
  });
  pool.on("error", () =>
    console.error(
      "Conexão ociosa com o banco interrompida. Novas solicitações tentarão reconectar.",
    ),
  );
  return pool;
}
export async function migrate(
  pool: pg.Pool,
  directory = resolve("server/migrations"),
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(472930621)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(directory))
      .filter((n) => /^\d+.*\.sql$/.test(n))
      .sort();
    for (const name of files) {
      const sql = await readFile(resolve(directory, name), "utf8"),
        checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(
            `A migração ${name} já foi aplicada com outro conteúdo.`,
          );
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(472930621)");
    } finally {
      client.release();
    }
  }
}
