// Standalone (same reasoning as record-deploy.mjs/send-due-reminders.mjs -
// plain `node`, no next/server, and can't import lib/google-calendar.ts
// directly since that's TypeScript inside the Next app). Pulls Google
// Calendar events (read-only mirror - see lib/google-calendar.ts for the
// v1 scope) into google_events_cache, replacing it wholesale each run so
// deleted-on-Google events don't linger. Pulls every calendar on the
// account (via calendarList), not just primary - this is what brings in
// Birthdays and any other named calendars. Requires the broadened
// calendar.readonly scope (see lib/google-calendar.ts's
// GOOGLE_CALENDAR_SCOPES) - a refresh_token issued before that scope was
// added won't have access to this endpoint and needs reconnecting via the
// "Connect Google Calendar" link (forces prompt=consent, so reconnecting
// re-grants the broader scope).
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

const calListRes = await fetch(
  "https://www.googleapis.com/calendar/v3/users/me/calendarList",
  { headers: { Authorization: `Bearer ${access_token}` } }
);
if (!calListRes.ok) {
  console.error("Calendar list failed:", await calListRes.text());
  process.exit(1);
}
const { items: calendars } = await calListRes.json();

const params = new URLSearchParams({
  timeMin: rangeStart,
  timeMax: rangeEnd,
  singleEvents: "true",
  orderBy: "startTime",
  maxResults: "250",
});

const allEvents = [];
for (const cal of calendars ?? []) {
  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  if (!eventsRes.ok) {
    // One calendar failing (e.g. a read-only subscribed calendar with odd
    // permissions) shouldn't take down the whole sync - skip and continue.
    console.error(`Event list failed for calendar "${cal.summary}":`, await eventsRes.text());
    continue;
  }
  const { items } = await eventsRes.json();
  for (const e of items ?? []) {
    allEvents.push({ ...e, calendarName: cal.summary ?? cal.id });
  }
}

// OR REPLACE, not plain INSERT - gcal_event_id is the primary key, and
// while IDs are unique per-calendar, nothing guarantees uniqueness ACROSS
// calendars now that multiple are pulled; a rare collision would abort the
// whole replaceAll transaction otherwise.
const insert = db.prepare(
  `INSERT OR REPLACE INTO google_events_cache (gcal_event_id, title, description, start, end, all_day, calendar_name, synced_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
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
      e.calendarName
    );
  }
});
replaceAll(allEvents);

console.log(`synced ${allEvents.length} Google Calendar events across ${(calendars ?? []).length} calendars`);
