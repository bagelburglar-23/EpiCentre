import { connection } from "next/server";
import { getDb, isProduction } from "@/lib/db";

// A named list that groups todos. The "Inbox" (todos with list_id = NULL)
// is a virtual list the UI always shows; it has no row here.
export type List = {
  id: number;
  name: string;
  isTest: boolean;
};

type Row = { id: number; name: string; is_test: number };

// Read at render time - needs connection() for the same reason listTodos
// does (see lib/todos.ts): without it the query freezes into the static
// shell at build time instead of reading live data.
export async function listLists(): Promise<List[]> {
  await connection();
  const rows = getDb()
    .prepare(
      isProduction()
        ? `SELECT id, name, is_test FROM lists WHERE is_test = 0 ORDER BY sort_order ASC, created_at ASC`
        : `SELECT id, name, is_test FROM lists ORDER BY sort_order ASC, created_at ASC`
    )
    .all() as Row[];
  return rows.map((r) => ({ id: r.id, name: r.name, isTest: !!r.is_test }));
}

// Mutation cores - plain functions (see ARCHITECTURE.md "mutation core +
// adapter"). New lists go to the end of the order.
export function createList(name: string, isTest: boolean): void {
  const n = name.trim();
  if (!n) return;
  const forcedTest = isProduction() ? false : isTest;
  const db = getDb();
  const { m } = db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM lists`)
    .get() as { m: number };
  db.prepare(
    `INSERT INTO lists (name, is_test, sort_order, updated_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(n, forcedTest ? 1 : 0, m + 1);
}

export function renameList(id: number, name: string): void {
  const n = name.trim();
  if (!n) return;
  getDb()
    .prepare(`UPDATE lists SET name = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(n, id);
}

// Deleting a list sends its items back to the Inbox (list_id = NULL) rather
// than deleting them - safer, and the user can re-file them. Done in one
// transaction so items are never briefly orphaned to a missing list.
export function deleteList(id: number): void {
  const db = getDb();
  db.transaction((listId: number) => {
    db.prepare(
      `UPDATE todos SET list_id = NULL, updated_at = datetime('now') WHERE list_id = ?`
    ).run(listId);
    db.prepare(`DELETE FROM lists WHERE id = ?`).run(listId);
  })(id);
}
