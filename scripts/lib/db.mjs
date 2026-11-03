import Database from "better-sqlite3";

// Shared DB open for the standalone scripts. They can't import lib/db.ts
// (it pulls in next/server's connection(), which only resolves inside Next's
// runtime), so this is the one place the path default + WAL pragma live.
export function openDb() {
  const db = new Database(process.env.DATABASE_PATH ?? "./epicentre.dev.db");
  db.pragma("journal_mode = WAL");
  return db;
}
