import { getDb } from "@/lib/db";

// No next/server import here, deliberately - this module is used both from
// server actions (inside Next's runtime) AND scripts/sync-google-events.mjs
// (standalone, plain `node`, same constraint that keeps record-deploy.mjs
// and send-due-reminders.mjs out of lib/ - see those for the pattern).
//
// v1 scope (agreed in conversation): push NEW EpiC events to Google
// (one-way), pull EXISTING Google events into Cal+ read-only (one-way,
// opposite direction, no edits flow back). Two-way edit sync is explicitly
// not built - that needs a conflict-resolution design not worth rushing.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_LIST_API = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
function calendarEventsUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}
// calendar.events (push) + calendar.readonly (list/read every calendar on
// the account, not just primary - needed for Birthdays etc, see
// scripts/sync-google-events.mjs). Widening this scope means an
// already-connected refresh_token won't have it - reconnecting via
// getAuthUrl (forces prompt=consent) re-grants it.
export const GOOGLE_CALENDAR_SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isGoogleCalendarConnected(): boolean {
  const row = getDb().prepare(`SELECT 1 FROM google_auth WHERE id = 1`).get();
  return !!row;
}

// redirectUri is passed in, not read from env - it must exactly match
// whichever origin initiated the request (prod's URL is what's actually
// registered with Google; see lib/db.ts on why UAT doesn't need its own).
export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on re-auth
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    throw new Error(
      "No refresh_token in Google's response - this happens on re-auth without " +
        "prompt=consent, or if a token was already issued for this account. " +
        "Revoke access at https://myaccount.google.com/permissions and try again."
    );
  }
  getDb()
    .prepare(
      `INSERT INTO google_auth (id, refresh_token, connected_at) VALUES (1, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET refresh_token = excluded.refresh_token, connected_at = excluded.connected_at`
    )
    .run(data.refresh_token);
}

async function getAccessToken(): Promise<string> {
  const row = getDb().prepare(`SELECT refresh_token FROM google_auth WHERE id = 1`).get() as
    | { refresh_token: string }
    | undefined;
  if (!row) throw new Error("Google Calendar is not connected");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type EventTimeField = { date: string } | { dateTime: string; timeZone: string };

function toGoogleTime(iso: string, allDay: boolean): EventTimeField {
  return allDay ? { date: iso.slice(0, 10) } : { dateTime: iso, timeZone: "UTC" };
}

function fromGoogleTime(field: { date?: string; dateTime?: string }): {
  iso: string;
  allDay: boolean;
} {
  if (field.date) return { iso: `${field.date}T00:00:00`, allDay: true };
  return { iso: field.dateTime!, allDay: false };
}

// Pushes a new EpiC event to Google, returns the created event's id to
// store as events.gcal_event_id. Caller's responsibility to only call this
// for non-test events (is_test rows never touch the real Google account).
export async function pushEventToGoogle(event: {
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
}): Promise<string> {
  const accessToken = await getAccessToken();
  const res = await fetch(calendarEventsUrl("primary"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description ?? undefined,
      start: toGoogleTime(event.start, event.allDay),
      end: toGoogleTime(event.end, event.allDay),
    }),
  });
  if (!res.ok) throw new Error(`Google event push failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export type FetchedGoogleEvent = {
  gcalEventId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  calendarName: string;
};

async function listCalendars(
  accessToken: string
): Promise<{ id: string; summary: string }[]> {
  const res = await fetch(CALENDAR_LIST_API, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google calendar list failed: ${await res.text()}`);
  const data = (await res.json()) as { items: { id: string; summary?: string }[] };
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary ?? c.id }));
}

// Used by scripts/sync-google-events.mjs (that copy is kept in sync by
// hand, not imported - see its own header). Pulls every calendar on the
// account (Birthdays etc, not just primary), rangeStart/End are ISO
// datetimes.
export async function fetchGoogleEvents(
  rangeStart: string,
  rangeEnd: string
): Promise<FetchedGoogleEvent[]> {
  const accessToken = await getAccessToken();
  const calendars = await listCalendars(accessToken);
  const params = new URLSearchParams({
    timeMin: rangeStart,
    timeMax: rangeEnd,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const results: FetchedGoogleEvent[] = [];
  for (const cal of calendars) {
    const res = await fetch(`${calendarEventsUrl(cal.id)}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue; // one calendar's odd permissions shouldn't fail the whole pull
    const data = (await res.json()) as {
      items: {
        id: string;
        summary?: string;
        description?: string;
        start: { date?: string; dateTime?: string };
        end: { date?: string; dateTime?: string };
      }[];
    };
    for (const item of data.items ?? []) {
      const start = fromGoogleTime(item.start);
      const end = fromGoogleTime(item.end);
      results.push({
        gcalEventId: item.id,
        title: item.summary ?? "(untitled)",
        description: item.description ?? null,
        start: start.iso,
        end: end.iso,
        allDay: start.allDay,
        calendarName: cal.summary,
      });
    }
  }
  return results;
}
