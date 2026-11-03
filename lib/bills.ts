import { connection } from "next/server";
import { getDb, isProduction } from "@/lib/db";
import { emptyBill, type BillData } from "@/lib/bill-calc";

export type Bill = {
  id: number;
  name: string;
  data: BillData;
  isTest: boolean;
};

type Row = { id: number; name: string; data: string; is_test: number };

function parseData(s: string): BillData {
  try {
    const d = JSON.parse(s) as Partial<BillData>;
    return {
      participants: Array.isArray(d.participants) ? d.participants : [],
      items: Array.isArray(d.items) ? d.items : [],
    };
  } catch {
    return emptyBill();
  }
}

export async function listBills(): Promise<Bill[]> {
  await connection();
  const rows = getDb()
    .prepare(
      isProduction()
        ? `SELECT id, name, data, is_test FROM bills WHERE is_test = 0 ORDER BY created_at DESC`
        : `SELECT id, name, data, is_test FROM bills ORDER BY created_at DESC`
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    data: parseData(r.data),
    isTest: !!r.is_test,
  }));
}

export function createBill(name: string, isTest: boolean): void {
  const n = name.trim();
  if (!n) return;
  const forcedTest = isProduction() ? false : isTest;
  getDb()
    .prepare(
      `INSERT INTO bills (name, is_test, updated_at) VALUES (?, ?, datetime('now'))`
    )
    .run(n, forcedTest ? 1 : 0);
}

// The client sends the whole bill as a serialized BillData string. Validate
// it parses before storing (defensive), and re-stringify to normalize.
export function saveBill(id: number, name: string, dataJson: string): void {
  const n = name.trim();
  if (!n) return;
  let normalized: string;
  try {
    normalized = JSON.stringify(JSON.parse(dataJson));
  } catch {
    return;
  }
  getDb()
    .prepare(
      `UPDATE bills SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(n, normalized, id);
}

export function deleteBill(id: number): void {
  getDb().prepare(`DELETE FROM bills WHERE id = ?`).run(id);
}
