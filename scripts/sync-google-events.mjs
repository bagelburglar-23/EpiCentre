// Standalone (same reasoning as record-deploy.mjs/send-due-reminders.mjs -
// plain `node`, no next/server, and can't import lib/google-calendar.ts
// directly since that's TypeScript inside the Next app). Pulls Google
// Calendar events (read-only mirror - see lib/google-calendar.ts for the
// v1 scope) into google_events_cache, replacing it wholesale each run so
// deleted-on-Google events don't linger.
//
// Usage: node scripts/sync-google-events.mjs
// Requires env: DATABASE_PATH, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import Database from "better-sqlite3";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set - skipping, no-op.");
  process.exit(0);
}

const path = process.env.DATABASE_PATH ?? "./epicentre.dev.db";
const db = new Database(path);
db.pragma("journal_mode = WAL");

const authRow = db.prepare(`SELECT refresh_token FROM google_auth WHERE id = 1`).get();
if (!authRow) {
  console.log("Google Calendar not connected yet - skipping, no-op.");
  process.exit(0);
}

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    refresh_token: authRow.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  }),
});
if (!tokenRes.ok) {
  console.error("Token refresh failed:", await tokenRes.text());
  process.exit(1);
}
const { access_token } = await tokenRes.json();

// 1 year back, 1 year forward - matches app/page.tsx's own window for the
// locally-created events, so the two sources cover the same range.
const now = new Date();
const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
const rangeEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 11, 31)).toISOString();

const params = new URLSearchParams({
  timeMin: rangeStart,
  timeMax: rangeEnd,
  singleEvents: "true",
  orderBy: "startTime",
  maxResults: "250",
});
const eventsRes = await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
  { headers: { Authorization: `Bearer ${access_token}` } }
);
if (!eventsRes.ok) {
  console.error("Event list failed:", await eventsRes.text());
  process.exit(1);
}
const { items } = await eventsRes.json();

const insert = db.prepare(
  `INSERT INTO google_events_cache (gcal_event_id, title, description, start, end, all_day, synced_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
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
      allDay ? 1 : 0
    );
  }
});
replaceAll(items ?? []);

console.log(`synced ${(items ?? []).length} Google Calendar events`);
