import { connection } from "next/server";
import { getDb } from "@/lib/db";

// Reminder slots are the times (HKT) the Telegram digest fires. Editable from
// Settings; the standalone reminder script reads them (its own copy of the
// query - it can't import this file).
export type ReminderSlot = { id: number; time: string; enabled: boolean };

type Row = { id: number; time: string; enabled: number };

// "HH:MM", 00:00–23:59.
function normalizeTime(t: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export async function listReminderSlots(): Promise<ReminderSlot[]> {
  await connection();
  const rows = getDb()
    .prepare(`SELECT id, time, enabled FROM reminder_slots ORDER BY time ASC`)
    .all() as Row[];
  return rows.map((r) => ({ id: r.id, time: r.time, enabled: !!r.enabled }));
}

export function addReminderSlot(time: string): void {
  const t = normalizeTime(time);
  if (!t) return;
  getDb()
    .prepare(`INSERT INTO reminder_slots (time, updated_at) VALUES (?, datetime('now'))`)
    .run(t);
}

// Changing the time resets last_sent so a slot moved earlier can still fire
// today (and one moved later doesn't double-fire).
export function updateReminderSlot(id: number, time: string, enabled: boolean): void {
  const t = normalizeTime(time);
  if (!t) return;
  getDb()
    .prepare(
      `UPDATE reminder_slots SET time = ?, enabled = ?, last_sent = NULL, updated_at = datetime('now') WHERE id = ?`
    )
    .run(t, enabled ? 1 : 0, id);
}

export function deleteReminderSlot(id: number): void {
  getDb().prepare(`DELETE FROM reminder_slots WHERE id = ?`).run(id);
}
