import { connection } from "next/server";
import { getDb, isProduction } from "@/lib/db";

export type CalEvent = {
  id: number;
  title: string;
  description: string | null;
  start: string; // ISO datetime
  end: string; // ISO datetime
  allDay: boolean;
  isTest: boolean;
};

type Row = {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string;
  all_day: number;
  is_test: number;
};

function toEvent(r: Row): CalEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    start: r.start,
    end: r.end,
    allDay: !!r.all_day,
    isTest: !!r.is_test,
  };
}

// Read at render time - connection()-gated for the same reason every other
// render-time query in this app is (see lib/db.ts / lib/todos.ts): without
// it, Next.js 16's Cache Components freezes the result into the static
// build instead of reflecting live data per request.
export async function listEventsInRange(
  rangeStart: string,
  rangeEnd: string
): Promise<CalEvent[]> {
  await connection();
  const rows = getDb()
    .prepare(
      isProduction()
        ? `SELECT id, title, description, start, end, all_day, is_test FROM events
           WHERE is_test = 0 AND start < ? AND end >= ? ORDER BY start ASC`
        : `SELECT id, title, description, start, end, all_day, is_test FROM events
           WHERE start < ? AND end >= ? ORDER BY start ASC`
    )
    .all(rangeEnd, rangeStart) as Row[];
  return rows.map(toEvent);
}

// Mutation cores - plain functions, no FormData/cookies/redirect (see
// ARCHITECTURE.md "Actions: mutation core + adapter").
// Returns the new row's id (or null if validation failed) - the action
// adapter needs it to push the event to Google right after.
export function addEvent(
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean,
  isTest: boolean
): { id: number; isTest: boolean } | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !start) return null;
  const forcedTest = isProduction() ? false : isTest;
  const info = getDb()
    .prepare(
      `INSERT INTO events (title, description, start, end, all_day, is_test, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      trimmedTitle,
      description.trim() || null,
      start,
      end || start,
      allDay ? 1 : 0,
      forcedTest ? 1 : 0
    );
  return { id: Number(info.lastInsertRowid), isTest: forcedTest };
}

// Returns the deleted row's Google id + test flag so the action adapter can
// also remove it from Google (EpiC-origin events only).
export function deleteEvent(id: number): {
  gcalEventId: string | null;
  isTest: boolean;
} {
  const db = getDb();
  const row = db
    .prepare(`SELECT gcal_event_id, is_test FROM events WHERE id = ?`)
    .get(id) as { gcal_event_id: string | null; is_test: number } | undefined;
  db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
  return { gcalEventId: row?.gcal_event_id ?? null, isTest: !!row?.is_test };
}

// Returns whether the row changed, plus its Google id + test flag, so the
// action adapter can PATCH the same edit onto Google for EpiC-origin events
// (those with a gcal_event_id from an earlier push). Pushing edits back to
// Google was previously deferred; it is now wired for EpiC-origin events.
// Google-SOURCED events are still not editable from Cal+ (read-only cache).
export function updateEvent(
  id: number,
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean
): { changed: boolean; gcalEventId: string | null; isTest: boolean } {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !start) {
    return { changed: false, gcalEventId: null, isTest: false };
  }
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE events SET title = ?, description = ?, start = ?, end = ?, all_day = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(trimmedTitle, description.trim() || null, start, end || start, allDay ? 1 : 0, id);
  const row = db
    .prepare(`SELECT gcal_event_id, is_test FROM events WHERE id = ?`)
    .get(id) as { gcal_event_id: string | null; is_test: number } | undefined;
  return {
    changed: info.changes > 0,
    gcalEventId: row?.gcal_event_id ?? null,
    isTest: !!row?.is_test,
  };
}

export function markSyncedToGoogle(id: number, gcalEventId: string): void {
  getDb()
    .prepare(
      `UPDATE events SET gcal_event_id = ?, synced_at = datetime('now') WHERE id = ?`
    )
    .run(gcalEventId, id);
}

export type CachedGoogleEvent = {
  gcalEventId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  calendarName: string | null;
  calendarId: string | null; // null until the next sync repopulates the cache
};

type CacheRow = {
  gcal_event_id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  all_day: number;
  calendar_name: string | null;
  calendar_id: string | null;
};

// Reflect a Google-sourced event's edit in the local cache so Cal+ updates
// immediately. The 30-min sync overwrites this row wholesale anyway; this
// just avoids waiting for it after an edit.
export function updateCachedGoogleEvent(
  gcalEventId: string,
  fields: {
    title: string;
    description: string | null;
    start: string;
    end: string;
    allDay: boolean;
  }
): void {
  getDb()
    .prepare(
      `UPDATE google_events_cache SET title = ?, description = ?, start = ?, end = ?, all_day = ?, synced_at = datetime('now')
       WHERE gcal_event_id = ?`
    )
    .run(
      fields.title,
      fields.description,
      fields.start,
      fields.end,
      fields.allDay ? 1 : 0,
      gcalEventId
    );
}

export function deleteCachedGoogleEvent(gcalEventId: string): void {
  getDb()
    .prepare(`DELETE FROM google_events_cache WHERE gcal_event_id = ?`)
    .run(gcalEventId);
}

// Read-only mirror, populated by scripts/sync-google-events.mjs - see that
// file and lib/google-calendar.ts for why this is a separate cache table
// rather than a live API call per page load.
export async function listCachedGoogleEvents(
  rangeStart: string,
  rangeEnd: string
): Promise<CachedGoogleEvent[]> {
  await connection();
  const rows = getDb()
    .prepare(
      `SELECT gcal_event_id, title, description, start, end, all_day, calendar_name, calendar_id
       FROM google_events_cache WHERE start < ? AND end >= ? ORDER BY start ASC`
    )
    .all(rangeEnd, rangeStart) as CacheRow[];
  return rows.map((r) => ({
    gcalEventId: r.gcal_event_id,
    title: r.title,
    description: r.description,
    start: r.start,
    end: r.end,
    allDay: !!r.all_day,
    calendarName: r.calendar_name,
    calendarId: r.calendar_id,
  }));
}
