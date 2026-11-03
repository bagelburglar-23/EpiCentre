// Standalone (same reasoning as record-deploy.mjs - doesn't import
// next/server, so it runs via plain `node`, outside Next's runtime).
// Fired by send-reminders.timer three times a day (08:30 / 16:00 / 22:00 HKT).
//
// What it sends: a digest of every OPEN to-do, grouped by list - ONE Telegram
// message per non-empty list. Several messages = several notifications, which
// is the "mini alarm" buzz pattern (tune later). A short time-aware greeting
// leads. Overdue and due-today items are flagged; test rows never page.
//
// Usage: node scripts/send-due-reminders.mjs
// Requires env: DATABASE_PATH, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import Database from "better-sqlite3";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set - skipping, no-op.");
  process.exit(0);
}

const path = process.env.DATABASE_PATH ?? "./epicentre.dev.db";
const db = new Database(path);
db.pragma("journal_mode = WAL");

// Every open, non-test to-do with its list name (NULL list = "Dump"). Ordered
// so dated items lead, soonest first. Reminders are a production concern, so
// is_test rows are excluded.
const rows = db
  .prepare(
    `SELECT t.text, t.due_date, t.list_id, l.name AS list_name
       FROM todos t
       LEFT JOIN lists l ON l.id = t.list_id
      WHERE t.done = 0 AND t.is_test = 0
      ORDER BY (t.due_date IS NULL), t.due_date ASC, t.created_at ASC`
  )
  .all();

if (rows.length === 0) {
  console.log("no open tasks - nothing to send.");
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

// due_date is a plain YYYY-MM-DD; at the three fire times (00:30/08:00/14:00
// UTC) the UTC date equals the HKT date, so a UTC "today" is correct here.
const today = new Date().toISOString().slice(0, 10);
function line(r) {
  const t = esc(r.text);
  if (!r.due_date) return `• ${t}`;
  const d = r.due_date.slice(0, 10);
  if (d < today) return `🔴 ${t} — <i>overdue</i> (${d})`;
  if (d === today) return `🟡 ${t} — <b>due today</b>`;
  return `• ${t} — due ${d}`;
}

const hktHour = (new Date().getUTCHours() + 8) % 24;
const greeting =
  hktHour < 12
    ? "☀️ Good morning"
    : hktHour < 18
      ? "🔆 Afternoon check-in"
      : "🌙 Before you wind down";

const overdue = rows.filter((r) => r.due_date && r.due_date.slice(0, 10) < today).length;
const dueToday = rows.filter((r) => r.due_date && r.due_date.slice(0, 10) === today).length;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(html) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.error("telegram send failed:", await res.text());
  return res.ok;
}

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

console.log(`sent ${sent + 1} message(s): summary + ${sent}/${groups.size} lists`);
