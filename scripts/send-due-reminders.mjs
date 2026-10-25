// Standalone (same reasoning as record-deploy.mjs - doesn't import
// next/server, so it can run via plain `node`, outside Next's runtime).
// Intended to run periodically via a systemd timer on the VPS (not wired
// up yet - needs TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID first, see below).
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

// Mirrors lib/todos.ts's dueSoonQuery() - kept in sync by hand since this
// script can't import that file (it's inside a Next.js app, this runs
// standalone). Only ever touches non-test rows: reminders are a
// production-only concern, UAT test entries never page anyone.
const dueSoon = db
  .prepare(
    `SELECT id, text, due_date FROM todos
     WHERE done = 0 AND is_test = 0 AND due_date IS NOT NULL
       AND reminder_sent = 0 AND date(due_date) <= date('now', '+1 day')`
  )
  .all();

if (dueSoon.length === 0) {
  console.log("nothing due - nothing to send.");
  process.exit(0);
}

for (const todo of dueSoon) {
  const text = `Reminder: "${todo.text}" is due ${todo.due_date}`;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) {
    console.error(`failed to send reminder for todo ${todo.id}:`, await res.text());
    continue; // leave reminder_sent = 0, retried next run
  }
  db.prepare(`UPDATE todos SET reminder_sent = 1 WHERE id = ?`).run(todo.id);
  console.log(`sent reminder for todo ${todo.id}: ${todo.text}`);
}
