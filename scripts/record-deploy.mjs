// Standalone - deliberately does NOT import lib/db.ts, which pulls in
// next/server's connection() and only resolves inside Next's own runtime.
// Run directly with plain `node` from CI after a successful deploy:
//   node scripts/record-deploy.mjs <production|preview> <commit-sha>
import Database from "better-sqlite3";

const [environment, commitSha] = process.argv.slice(2);
if (!["production", "preview"].includes(environment) || !commitSha) {
  console.error("usage: node scripts/record-deploy.mjs <production|preview> <commit-sha>");
  process.exit(1);
}

const path = process.env.DATABASE_PATH ?? "./epicentre.dev.db";
const db = new Database(path);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS deploy_state (
    environment TEXT PRIMARY KEY,
    commit_sha TEXT NOT NULL,
    deployed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.prepare(
  `INSERT INTO deploy_state (environment, commit_sha, deployed_at)
   VALUES (?, ?, datetime('now'))
   ON CONFLICT(environment) DO UPDATE SET
     commit_sha = excluded.commit_sha,
     deployed_at = excluded.deployed_at`
).run(environment, commitSha);

console.log(`recorded ${environment} -> ${commitSha}`);
