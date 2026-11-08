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

export function getDb(): Database.Database {
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
  // todos: the first real (non-smoke-test) module's table. is_test follows
  // the standing convention from the PROD/UAT design - PROD never sees rows
  // where is_test = 1; UAT sees everything. Not yet run through Drizzle/the
  // full modules/ pattern - that formalization is still ahead; this is raw
  // SQL on the same shared connection, kept deliberately simple for now.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      is_test INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Additive-only columns (see ARCHITECTURE.md / Step 1's PROD/UAT design
  // on why: this table is on the shared database, so a destructive change
  // here would break the other environment immediately, not just at merge
  // time). `text` stays the DB column name for the title - only adding
  // columns, never renaming one on a live shared table.
  for (const stmt of [
    `ALTER TABLE todos ADD COLUMN details TEXT`,
    `ALTER TABLE todos ADD COLUMN due_date TEXT`,
    `ALTER TABLE todos ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try {
      instance.exec(stmt);
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes("duplicate column")) throw e;
    }
  }

  // Lists: the To-Do module became multi-list ("Lists"). A `lists` row
  // groups todos; `todos.list_id` is a nullable reference to it. NULL means
  // the virtual "Inbox", so every todo that existed before this change keeps
  // showing with no data migration. is_test follows the shared-DB
  // convention (prod hides is_test = 1). Additive only.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_test INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    instance.exec(`ALTER TABLE todos ADD COLUMN list_id INTEGER`);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("duplicate column")) throw e;
  }

  // Cal+ base. gcal_event_id/synced_at are forward-looking columns for the
  // not-yet-built Google Calendar sync (see lib/google-calendar.ts) - added
  // now, nullable, so that feature doesn't need its own schema migration
  // later. start/end are ISO 8601 datetimes; all_day events still set both,
  // at midnight, for simpler range queries.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0,
      is_test INTEGER NOT NULL DEFAULT 0,
      gcal_event_id TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Google Calendar sync. Single row (id=1 always) - one Google account,
  // one connection, shared by prod and UAT alike (see lib/google-calendar.ts
  // - this is why the refresh token lives in the shared DB rather than an
  // env var: only prod's redirect URI is registered with Google, but once
  // connected, UAT reads the same token from here, no separate OAuth needed).
  instance.exec(`
    CREATE TABLE IF NOT EXISTS google_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      refresh_token TEXT NOT NULL,
      connected_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Read-only local cache of events pulled FROM Google Calendar (v1 pull
  // direction - see GCAL_SETUP.md / conversation history on why this is
  // read-only: editing a Google-sourced event from Cal+ is the two-way-sync
  // conflict problem deliberately deferred). Repopulated wholesale by
  // scripts/sync-google-events.mjs on a timer, not written to elsewhere.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS google_events_cache (
      gcal_event_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Additive - see the todos table above for why ALTER TABLE rather than
  // widening the CREATE TABLE. calendar_name distinguishes which Google
  // calendar an event came from (primary/Birthdays/etc - see
  // scripts/sync-google-events.mjs, now pulling all of them, not just
  // primary). Nullable since rows synced before this column existed won't
  // have it until the next sync run overwrites them.
  try {
    instance.exec(`ALTER TABLE google_events_cache ADD COLUMN calendar_name TEXT`);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("duplicate column")) throw e;
  }
  // calendar_id: which Google calendar an event lives on. Needed to PATCH/
  // DELETE the right calendar when a Google-sourced event is edited from
  // Cal+ (two-way edit). Null until the next sync run repopulates the cache.
  try {
    instance.exec(`ALTER TABLE google_events_cache ADD COLUMN calendar_id TEXT`);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("duplicate column")) throw e;
  }
  // Bills (EpiSplit): one row per outing. The whole bill - participants,
  // items, per-item per-person shares, tax rates - is a JSON document in
  // `data`, edited and recomputed as a unit (see lib/bill-calc.ts). A
  // document blob fits this far better than 4 relational tables at
  // personal-bill scale. is_test follows the shared-DB convention.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{"participants":[],"items":[]}',
      is_test INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Reminder slots: the times (HKT) the Telegram digest fires. Editable from
  // Settings; the timer is now a dumb 5-min ticker and send-due-reminders.mjs
  // decides whether a slot is due. last_sent (HKT date) stops a slot firing
  // twice in a day. Seeded once with the previous hard-coded trio.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS reminder_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_sent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const slotCount = instance
    .prepare(`SELECT COUNT(*) AS c FROM reminder_slots`)
    .get() as { c: number };
  if (slotCount.c === 0) {
    const seed = instance.prepare(`INSERT INTO reminder_slots (time) VALUES (?)`);
    for (const t of ["08:30", "16:00", "22:00"]) seed.run(t);
  }

  // App login password, moved off the APP_PASSWORD env var so it can be
  // changed from inside the app (see lib/account.ts) - no SSH/VPS access
  // needed, works from any logged-in device including Phone. Single row
  // (id=1), same shared-DB pattern as google_auth - this makes the login
  // password shared between PROD and UAT rather than two independently-set
  // env vars, which is the right simplification for a single-user app.
  // Empty until the first in-app password change; lib/account.ts falls
  // back to APP_PASSWORD until then, so this is a no-downtime cutover.
  instance.exec(`
    CREATE TABLE IF NOT EXISTS app_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return instance;
}

export function isProduction(): boolean {
  return process.env.DEPLOY_ENV === "production";
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
