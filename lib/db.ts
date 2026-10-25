import { connection } from "next/server";
import Database from "better-sqlite3";

// Production and preview point DATABASE_PATH at the SAME file (see
// ARCHITECTURE.md / state/decisions.md on the PROD/UAT relationship) - real
// data is shared, not synced; only `is_test` rows and the deployed code
// differ between the two. WAL mode is what makes two separate Node
// processes writing to one SQLite file safe at this traffic level.
//
// The connection is opened lazily, on first use, not at module import -
// Next.js 16's Cache Components can import this module while prerendering
// a static shell at build time, which would otherwise open the file (and
// read DATABASE_PATH) in the build environment instead of the server's.
let instance: Database.Database | null = null;

function getDb(): Database.Database {
  if (instance) return instance;
  const path = process.env.DATABASE_PATH ?? "./epicentre.dev.db";
  instance = new Database(path);
  instance.pragma("journal_mode = WAL");
  instance.exec(`
    CREATE TABLE IF NOT EXISTS deploy_state (
      environment TEXT PRIMARY KEY,
      commit_sha TEXT NOT NULL,
      deployed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return instance;
}

// Writing deploy_state rows happens via scripts/record-deploy.mjs (run
// standalone by CI, not through this module - it can't import next/server
// outside Next's own runtime). This file only ever reads that table.

// Deliberately async + connection() - see Next.js's own `connection()` docs,
// "Synchronous database drivers" example (better-sqlite3 is their example).
// Without this, the query runs once during `next build` and its result is
// frozen into the static shell, instead of reflecting live deploy state.
export async function getDeployedSha(
  environment: "production" | "preview"
): Promise<string | null> {
  await connection();
  const row = getDb()
    .prepare(`SELECT commit_sha FROM deploy_state WHERE environment = ?`)
    .get(environment) as { commit_sha: string } | undefined;
  return row?.commit_sha ?? null;
}
