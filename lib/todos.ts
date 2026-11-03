import { connection } from "next/server";
import { getDb, isProduction } from "@/lib/db";

export type Todo = {
  id: number;
  title: string;
  details: string | null;
  dueDate: string | null; // ISO date (YYYY-MM-DD), no time component
  done: boolean;
  isTest: boolean;
  listId: number | null; // null = Inbox (see lib/lists.ts)
};

type Row = {
  id: number;
  text: string;
  details: string | null;
  due_date: string | null;
  done: number;
  is_test: number;
  list_id: number | null;
};

function toTodo(r: Row): Todo {
  return {
    id: r.id,
    title: r.text,
    details: r.details,
    dueDate: r.due_date,
    done: !!r.done,
    isTest: !!r.is_test,
    listId: r.list_id,
  };
}

// Read at render time - needs connection() for the same reason
// getDeployedSha does (see lib/db.ts / app/layout.tsx): without it, this
// query runs once at build time and the list freezes into the static shell.
export async function listTodos(): Promise<Todo[]> {
  await connection();
  const rows = getDb()
    .prepare(
      isProduction()
        ? `SELECT id, text, details, due_date, done, is_test, list_id FROM todos WHERE is_test = 0 ORDER BY (due_date IS NULL), due_date ASC, created_at ASC`
        : `SELECT id, text, details, due_date, done, is_test, list_id FROM todos ORDER BY (due_date IS NULL), due_date ASC, created_at ASC`
    )
    .all() as Row[];
  return rows.map(toTodo);
}

// Mutation cores - plain functions, no FormData/cookies/redirect (see
// ARCHITECTURE.md "Actions: mutation core + adapter"). No connection()
// needed here: these only ever run from a server action, which is already
// request-time by nature, never part of a prerendered shell.
export function addTodo(
  title: string,
  details: string,
  dueDate: string,
  isTest: boolean,
  listId: number | null
): void {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;
  // On production, isTest is always forced false regardless of what's
  // passed - the "Add as test" option only renders on UAT in the first
  // place, but this is the actual enforcement point.
  const forcedTest = isProduction() ? false : isTest;
  getDb()
    .prepare(
      `INSERT INTO todos (text, details, due_date, is_test, list_id, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      trimmedTitle,
      details.trim() || null,
      dueDate || null,
      forcedTest ? 1 : 0,
      listId ?? null
    );
}

// Idempotent: same input twice leaves the same row. If the due date
// changes, reminder_sent is reset so the Telegram reminder fires for the
// new date instead of being suppressed by the old one having fired.
export function updateTodo(
  id: number,
  title: string,
  details: string,
  dueDate: string,
  listId: number | null
): void {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;
  getDb()
    .prepare(
      `UPDATE todos
       SET text = ?, details = ?,
           reminder_sent = CASE WHEN due_date IS ? THEN reminder_sent ELSE 0 END,
           due_date = ?, list_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      trimmedTitle,
      details.trim() || null,
      dueDate || null,
      dueDate || null,
      listId ?? null,
      id
    );
}

export function toggleTodo(id: number): void {
  getDb()
    .prepare(`UPDATE todos SET done = NOT done, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function deleteTodo(id: number): void {
  getDb().prepare(`DELETE FROM todos WHERE id = ?`).run(id);
}

// Used by scripts/send-due-reminders.mjs (Telegram) - not through this
// module there either (same next/server constraint as recordDeploy had).
// Kept here as the one place the query itself is defined, for reuse/tests.
export function dueSoonQuery(): string {
  return `
    SELECT id, text, due_date FROM todos
    WHERE done = 0
      AND due_date IS NOT NULL
      AND reminder_sent = 0
      AND date(due_date) <= date('now', '+1 day')
  `;
}
