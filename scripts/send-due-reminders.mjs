// Standalone (same reasoning as record-deploy.mjs - doesn't import
// next/server, so it runs via plain `node`, outside Next's runtime).
//
// Fired every 5 minutes by send-reminders.timer (a dumb ticker). The SCHEDULE
// lives in the DB now (reminder_slots, editable from Settings - Reminders),
// not in the timer. Each run works out HKT-now, finds any enabled slot that
// has come due and hasn't fired today, and sends the digest once. last_sent
// (an HKT date) is the idempotency key that stops a slot double-firing within
// its window. A 30-min catch-up window means a slot still fires if the box was
// briefly asleep at the exact minute.
//
// What it sends: a digest of every OPEN to-do, grouped by list - ONE Telegram
// message per non-empty list. Several messages = several notifications, which
// is the "mini alarm" buzz pattern. A short time-aware greeting leads. Overdue
// and due-today items are flagged; test rows never page.
//
// Usage: node scripts/send-due-reminders.mjs
// Requires env: DATABASE_PATH, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import { openDb } from "./lib/db.mjs";
import { sendTelegram } from "./lib/telegram.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set - skipping, no-op.");
  process.exit(0);
}

const db = openDb();

// The per-list mute switch (lists.reminders_enabled) is normally added by the
// Next app's getDb() on first use. This standalone timer can fire before the
// app has handled a request after a deploy, so ensure the column exists here
// too - idempotent, same default as the app. Without it the query below would
// throw on a fresh DB.
try {
  db.exec(`ALTER TABLE lists ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1`);
} catch {
  // already exists - fine
}

// HKT is UTC+8, no DST. Both the current HKT date (the per-day idempotency key)
// and minute-of-day come from shifting the UTC clock by 8 hours.
const HKT_OFFSET_MIN = 8 * 60;
const nowUtc = new Date();
const hktDate = new Date(nowUtc.getTime() + HKT_OFFSET_MIN * 60_000)
  .toISOString()
  .slice(0, 10);
const hktMin = (nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + HKT_OFFSET_MIN) % 1440;
const hhmm = `${String(Math.floor(hktMin / 60)).padStart(2, "0")}:${String(
  hktMin % 60
).padStart(2, "0")}`;

// A slot is DUE when it's enabled, hasn't fired today, and HKT-now sits in the
// [slot, slot+30min) window. The window (vs an exact match) absorbs a missed
// tick; last_sent keeps it to one fire. Slots straddling midnight don't wrap -
// a 23:50 slot won't fire at 00:05 - which is the safe choice.
const WINDOW_MIN = 30;
const dueSlots = db
  .prepare(`SELECT id, time, last_sent FROM reminder_slots WHERE enabled = 1`)
  .all()
  .filter((s) => {
    if (s.last_sent === hktDate) return false;
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.time);
    if (!m) return false;
    const slotMin = Number(m[1]) * 60 + Number(m[2]);
    const delta = hktMin - slotMin;
    return delta >= 0 && delta < WINDOW_MIN;
  });

if (dueSlots.length === 0) {
  console.log(`HKT ${hhmm} - no slot due, nothing to send.`);
  process.exit(0);
}

// Marking happens AFTER the sends succeed, so a crash mid-send retries on the
// next tick (still inside the window) rather than silently swallowing the day.
const markStmt = db.prepare(
  `UPDATE reminder_slots SET last_sent = ?, updated_at = datetime('now') WHERE id = ?`
);
const markAllFired = () => {
  for (const s of dueSlots) markStmt.run(hktDate, s.id);
};

// Every open, non-test to-do with its list name (NULL list = "Dump"). Ordered
// so dated items lead, soonest first. Reminders are a production concern, so
// is_test rows are excluded. Muted lists (reminders_enabled = 0) are left out;
// unfiled items (list_id IS NULL / "Dump") always remind - they have no list
// row to mute.
const rows = db
  .prepare(
    `SELECT t.text, t.due_date, t.list_id, l.name AS list_name
       FROM todos t
       LEFT JOIN lists l ON l.id = t.list_id
      WHERE t.done = 0 AND t.is_test = 0
        AND (t.list_id IS NULL OR l.reminders_enabled = 1)
      ORDER BY (t.due_date IS NULL), t.due_date ASC, t.created_at ASC`
  )
  .all();

if (rows.length === 0) {
  // The slot still "fired" - you got the all-clear by silence. Mark it so we
  // don't re-check every 5 min for the rest of the window.
  markAllFired();
  console.log(`HKT ${hhmm} - slot due but no open tasks; marked fired.`);
  process.exit(0);
}

// Group by list (preserving the soonest-first order within each).
const groups = new Map();
for (const r of rows) {
  const name = r.list_id == null ? "Dump" : r.list_name ?? "Dump";
  if (!groups.has(name)) groups.set(name, []);
  groups.get(name).push(r);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Compare against the HKT date - the script now runs at arbitrary HKT times
// (a slot can be any UTC time), so a UTC "today" would be a day off for
// evening slots.
const today = hktDate;
function line(r) {
  const t = esc(r.text);
  if (!r.due_date) return `• ${t}`;
  const d = r.due_date.slice(0, 10);
  if (d < today) return `🔴 ${t} — <i>overdue</i> (${d})`;
  if (d === today) return `🟡 ${t} — <b>due today</b>`;
  return `• ${t} — due ${d}`;
}

const hktHour = Math.floor(hktMin / 60);
const greeting =
  hktHour < 12
    ? "☀️ Good morning"
    : hktHour < 18
      ? "🔆 Afternoon check-in"
      : "🌙 Before you wind down";

const overdue = rows.filter((r) => r.due_date && r.due_date.slice(0, 10) < today).length;
const dueToday = rows.filter((r) => r.due_date && r.due_date.slice(0, 10) === today).length;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (html) => sendTelegram(BOT_TOKEN, CHAT_ID, html);

// Lead summary, then one message per list (each its own notification).
let summary = `<b>${greeting}</b>\n${rows.length} open across ${groups.size} list${
  groups.size === 1 ? "" : "s"
}.`;
if (overdue) summary += ` 🔴 ${overdue} overdue.`;
if (dueToday) summary += ` 🟡 ${dueToday} due today.`;
await send(summary);

let sent = 0;
for (const [name, items] of groups) {
  await sleep(350); // space the sends so each buzzes separately
  const ok = await send(`<b>📋 ${esc(name)}</b>\n${items.map(line).join("\n")}`);
  if (ok) sent++;
}

markAllFired();
console.log(
  `HKT ${hhmm} - fired ${dueSlots.length} slot(s): sent ${sent + 1} message(s) (summary + ${sent}/${groups.size} lists).`
);
