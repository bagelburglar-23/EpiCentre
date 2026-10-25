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
export function addEvent(
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean,
  isTest: boolean
): void {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !start) return;
  const forcedTest = isProduction() ? false : isTest;
  getDb()
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
}

export function deleteEvent(id: number): void {
  getDb().prepare(`DELETE FROM events WHERE id = ?`).run(id);
}
