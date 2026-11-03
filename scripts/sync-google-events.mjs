// Standalone (plain `node`, no next/server - can't import lib/google-calendar.ts
// since that's TypeScript inside the Next app; the plain-JS equivalents live in
// scripts/lib/google.mjs). Pulls Google Calendar events (read-only mirror -
// see lib/google-calendar.ts for the v1 scope) into google_events_cache,
// replacing it wholesale each run so deleted-on-Google events don't linger.
// Pulls every calendar on the account, not just primary (brings in Birthdays
// etc). A refresh_token issued before the calendar.readonly scope was added
// needs reconnecting via "Connect Google Calendar" (forces prompt=consent).
//
// Usage: node scripts/sync-google-events.mjs
// Requires env: DATABASE_PATH, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import { openDb } from "./lib/db.mjs";
import { getAccessToken, fetchCalendarEvents } from "./lib/google.mjs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set - skipping, no-op.");
  process.exit(0);
}

const db = openDb();

const authRow = db.prepare(`SELECT refresh_token FROM google_auth WHERE id = 1`).get();
if (!authRow) {
  console.log("Google Calendar not connected yet - skipping, no-op.");
  process.exit(0);
}

const accessToken = await getAccessToken(authRow.refresh_token, CLIENT_ID, CLIENT_SECRET);

// 1 year back, 1 year forward - matches app/page.tsx's own window for the
// locally-created events, so the two sources cover the same range.
const now = new Date();
const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
const rangeEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 11, 31)).toISOString();

const allEvents = await fetchCalendarEvents(accessToken, rangeStart, rangeEnd);

// OR REPLACE, not plain INSERT - gcal_event_id is the primary key, and while
// IDs are unique per-calendar, nothing guarantees uniqueness ACROSS calendars
// now that multiple are pulled; a rare collision would abort the whole
// replaceAll transaction otherwise.
const insert = db.prepare(
  `INSERT OR REPLACE INTO google_events_cache (gcal_event_id, title, description, start, end, all_day, calendar_name, calendar_id, synced_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
);
const replaceAll = db.transaction((events) => {
  db.prepare(`DELETE FROM google_events_cache`).run();
  for (const e of events) {
    const allDay = !!e.start.date;
    insert.run(
      e.id,
      e.summary ?? "(untitled)",
      e.description ?? null,
      allDay ? `${e.start.date}T00:00:00` : e.start.dateTime,
      allDay ? `${e.end.date}T00:00:00` : e.end.dateTime,
      allDay ? 1 : 0,
      e.calendarName,
      e.calendarId
    );
  }
});
replaceAll(allEvents);

console.log(`synced ${allEvents.length} Google Calendar events`);
