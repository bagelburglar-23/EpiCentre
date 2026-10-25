import { connection } from "next/server";
import { getDb, isProduction } from "@/lib/db";

export type Todo = {
  id: number;
  text: string;
  done: boolean;
  isTest: boolean;
};

// Read at render time - needs connection() for the same reason
// getDeployedSha does (see lib/db.ts / app/layout.tsx): without it, this
// query runs once at build time and the list freezes into the static shell.
export async function listTodos(): Promise<Todo[]> {
  await connection();
  const rows = getDb()
    .prepare(
      isProduction()
        ? `SELECT id, text, done, is_test FROM todos WHERE is_test = 0 ORDER BY created_at ASC`
        : `SELECT id, text, done, is_test FROM todos ORDER BY created_at ASC`
    )
    .all() as { id: number; text: string; done: number; is_test: number }[];
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    done: !!r.done,
    isTest: !!r.is_test,
  }));
}

// Mutation cores - plain functions, no FormData/cookies/redirect (see
// ARCHITECTURE.md "Actions: mutation core + adapter"). No connection()
// needed here: these only ever run from a server action, which is already
// request-time by nature, never part of a prerendered shell.
export function addTodo(text: string, isTest: boolean): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  // On production, isTest is always forced false regardless of what's
  // passed - the "Add as test" option only renders on UAT in the first
  // place, but this is the actual enforcement point.
  const forcedTest = isProduction() ? false : isTest;
  getDb()
    .prepare(`INSERT INTO todos (text, is_test, updated_at) VALUES (?, ?, datetime('now'))`)
    .run(trimmed, forcedTest ? 1 : 0);
}

export function toggleTodo(id: number): void {
  getDb()
    .prepare(`UPDATE todos SET done = NOT done, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function deleteTodo(id: number): void {
  getDb().prepare(`DELETE FROM todos WHERE id = ?`).run(id);
}
