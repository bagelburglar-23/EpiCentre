"use client";

import { useRef, useState, useTransition } from "react";
import {
  createBillAction,
  saveBillAction,
  deleteBillAction,
} from "@/app/bills/actions";
import type { Bill } from "@/lib/bills";
import {
  computeTotals,
  money,
  type BillData,
  type BillItem,
} from "@/lib/bill-calc";
import SideRail from "@/components/SideRail";
import ReceiptScanner from "@/components/ReceiptScanner";
import { getPref } from "@/lib/prefs";
import type { ParsedItem } from "@/lib/receipt-parse";

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export default function BillsPanel({
  initialBills,
  isPreview,
}: {
  initialBills: Bill[];
  isPreview: boolean;
}) {
  const [bills, setBills] = useState(initialBills);
  // Adopt fresh server props for the rail (names/list) only. The active
  // editing buffer is loaded explicitly on selection, never re-synced from
  // props, so an in-flight autosave can't clobber what you're typing.
  const [prevBills, setPrevBills] = useState(initialBills);
  if (initialBills !== prevBills) {
    setPrevBills(initialBills);
    setBills(initialBills);
  }

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [buffer, setBuffer] = useState<BillData>({ participants: [], items: [] });
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTest, setNewTest] = useState(false);
  // Bulk delete: `selected` item ids; `selecting` only toggles the checkbox
  // column's visibility on mobile (desktop shows it always).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  // Spreadsheet-style range selection within one column (rows anchor..focus).
  const [sel, setSel] = useState<{ col: string; anchor: number; focus: number } | null>(
    null
  );
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  function save(id: number, billName: string, data: BillData) {
    startTransition(async () => {
      await saveBillAction(id, billName, JSON.stringify(data));
    });
    setDirty(false);
  }

  // Debounced autosave after edits settle.
  function scheduleSave(id: number, billName: string, data: BillData) {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(id, billName, data), 900);
  }

  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dirty && selectedId != null) save(selectedId, name, buffer);
  }

  function selectBill(id: number) {
    if (id === selectedId) return;
    flush();
    setSel(null);
    const b = bills.find((x) => x.id === id);
    setSelectedId(id);
    setName(b?.name ?? "");
    setBuffer(b?.data ?? { participants: [], items: [] });
    setDirty(false);
  }

  // --- edits (all go through commit, which schedules the autosave) ---
  function commit(next: BillData, nextName = name) {
    setBuffer(next);
    if (nextName !== name) setName(nextName);
    if (selectedId != null) scheduleSave(selectedId, nextName, next);
  }

  function setItem(itemId: string, patch: Partial<BillItem>) {
    commit({
      ...buffer,
      items: buffer.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    });
  }
  function setShare(itemId: string, pid: string, value: string) {
    const n = value === "" ? 0 : Math.max(0, Math.floor(Number(value) || 0));
    commit({
      ...buffer,
      items: buffer.items.map((it) =>
        it.id === itemId ? { ...it, shares: { ...it.shares, [pid]: n } } : it
      ),
    });
  }
  // Tax defaults to the Settings → EpiSplit rate (20% out of the box);
  // otherwise a new item (or scanned batch) inherits the last item's rate, so
  // you don't retype it. A scanned batch shares one rate (set in the scan
  // modal), then each item is individually editable.
  const lastTax = () => {
    const t = buffer.items[buffer.items.length - 1]?.taxPercent;
    return t && t.trim() ? t : getPref("episplit.defaultTax", "20");
  };
  function addItem() {
    commit({
      ...buffer,
      items: [
        ...buffer.items,
        { id: uid(), name: "", cost: "", taxPercent: lastTax(), shares: {} },
      ],
    });
  }
  // Items read off a receipt photo (ReceiptScanner): the whole batch shares
  // one tax rate (chosen in the scan modal); shares are filled in the grid.
  function addScanned(scanned: ParsedItem[], taxPercent: string) {
    commit({
      ...buffer,
      items: [
        ...buffer.items,
        ...scanned.map((s) => ({
          id: uid(),
          name: s.name,
          cost: s.cost,
          taxPercent,
          shares: {},
        })),
      ],
    });
  }
  function removeItem(itemId: string) {
    commit({ ...buffer, items: buffer.items.filter((it) => it.id !== itemId) });
  }

  // --- bulk delete ---
  function enterSelect(itemId: string) {
    setSelecting(true);
    setSelected(new Set([itemId]));
  }
  function toggleSelect(itemId: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });
  }
  function cancelSelect() {
    setSelected(new Set());
    setSelecting(false);
  }
  function deleteSelected() {
    commit({ ...buffer, items: buffer.items.filter((it) => !selected.has(it.id)) });
    cancelSelect();
  }

  // --- Excel-ish keyboard nav on the grid (desktop) ---
  function focusCell(row: number, col: string) {
    const el = gridRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${row}"][data-col="${col}"]`
    );
    if (el) {
      el.focus();
      el.select(); // land selected, so typing replaces (spreadsheet-style)
    }
  }
  function cellValue(it: BillItem, col: string): string {
    if (col === "cost") return it.cost;
    if (col === "tax") return it.taxPercent;
    if (col.startsWith("share:")) {
      const pid = col.slice(6);
      return it.shares[pid] ? String(it.shares[pid]) : "";
    }
    if (col === "name") return it.name;
    return "";
  }
  function withCell(it: BillItem, col: string, value: string): BillItem {
    if (col === "cost") return { ...it, cost: value };
    if (col === "tax") return { ...it, taxPercent: value };
    if (col.startsWith("share:")) {
      const pid = col.slice(6);
      const n = value === "" ? 0 : Math.max(0, Math.floor(Number(value) || 0));
      return { ...it, shares: { ...it.shares, [pid]: n } };
    }
    if (col === "name") return { ...it, name: value };
    return it;
  }
  function fillRange(col: string, value: string, top: number, bot: number) {
    commit({
      ...buffer,
      items: buffer.items.map((it, i) =>
        i >= top && i <= bot ? withCell(it, col, value) : it
      ),
    });
  }
  const inSel = (row: number, col: string) =>
    sel != null &&
    sel.col === col &&
    row >= Math.min(sel.anchor, sel.focus) &&
    row <= Math.max(sel.anchor, sel.focus);
  // Spreadsheet keys on the grid:
  //  ↑/↓ move a row, Enter moves down; ←/→ move a column at the text edge
  //  (so you can still edit within a cell); Ctrl/Cmd+arrows jump to the
  //  first/last row or column. Shift+↑/↓ selects a range down a column
  //  (Ctrl to the edge). Ctrl/Cmd+D fills the focused column, or - with a
  //  range selected - copies the top of the selection down it. Delete clears
  //  a multi-cell selection; Escape clears the selection.
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLInputElement;
    const col = t.dataset.col;
    const row = Number(t.dataset.row);
    if (!col || Number.isNaN(row)) return;

    const cols = [
      "name",
      "cost",
      "tax",
      ...buffer.participants.map((p) => `share:${p.id}`),
    ];
    const ci = cols.indexOf(col);
    const lastRow = buffer.items.length - 1;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const len = (t.value ?? "").length;
    const atStart = t.selectionStart === 0 && t.selectionEnd === 0;
    const atEnd = t.selectionStart === len && t.selectionEnd === len;

    // Extend a column selection with Shift (+Ctrl to the edge).
    if (shift && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const anchor = sel && sel.col === col ? sel.anchor : row;
      let focus = sel && sel.col === col ? sel.focus : row;
      focus =
        e.key === "ArrowDown"
          ? ctrl
            ? lastRow
            : Math.min(lastRow, focus + 1)
          : ctrl
            ? 0
            : Math.max(0, focus - 1);
      setSel({ col, anchor, focus });
      focusCell(focus, col);
      return;
    }

    if (ctrl && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (sel && sel.col === col) {
        const top = Math.min(sel.anchor, sel.focus);
        const bot = Math.max(sel.anchor, sel.focus);
        const value = buffer.items[top] ? cellValue(buffer.items[top], col) : t.value ?? "";
        fillRange(col, value, top, bot);
      } else {
        fillRange(col, t.value ?? "", 0, lastRow);
      }
      return;
    }

    if (e.key === "Escape") {
      if (sel) {
        e.preventDefault();
        setSel(null);
      }
      return;
    }

    // Delete clears a multi-cell selection (single cell keeps normal editing).
    if (e.key === "Delete" && sel && sel.col === col && sel.anchor !== sel.focus) {
      e.preventDefault();
      fillRange(col, "", Math.min(sel.anchor, sel.focus), Math.max(sel.anchor, sel.focus));
      return;
    }

    // Any non-extending key collapses the selection.
    if (sel && !shift) setSel(null);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(ctrl ? lastRow : Math.min(lastRow, row + 1), col);
    } else if (e.key === "Enter") {
      e.preventDefault();
      focusCell(Math.min(lastRow, row + 1), col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(ctrl ? 0 : Math.max(0, row - 1), col);
    } else if (e.key === "ArrowRight") {
      if (ctrl) {
        e.preventDefault();
        focusCell(row, cols[cols.length - 1]);
      } else if (atEnd && ci < cols.length - 1) {
        e.preventDefault();
        focusCell(row, cols[ci + 1]);
      }
    } else if (e.key === "ArrowLeft") {
      if (ctrl) {
        e.preventDefault();
        focusCell(row, cols[0]);
      } else if (atStart && ci > 0) {
        e.preventDefault();
        focusCell(row, cols[ci - 1]);
      }
    }
  }
  function addParticipant() {
    commit({
      ...buffer,
      participants: [...buffer.participants, { id: uid(), name: "" }],
    });
  }
  function setParticipantName(pid: string, value: string) {
    commit({
      ...buffer,
      participants: buffer.participants.map((p) =>
        p.id === pid ? { ...p, name: value } : p
      ),
    });
  }
  function removeParticipant(pid: string) {
    commit({
      ...buffer,
      participants: buffer.participants.filter((p) => p.id !== pid),
      items: buffer.items.map((it) => {
        const rest = { ...it.shares };
        delete rest[pid];
        return { ...it, shares: rest };
      }),
    });
  }

  // --- bill ops ---
  function submitNew() {
    const n = newName.trim();
    setCreating(false);
    if (!n) return;
    startTransition(async () => {
      await createBillAction(n, isPreview && newTest);
    });
    setNewName("");
    setNewTest(false);
  }
  function removeBill(id: number) {
    if (selectedId === id) {
      if (timer.current) clearTimeout(timer.current);
      setSelectedId(null);
      setBuffer({ participants: [], items: [] });
      setName("");
      setDirty(false);
    }
    setBills((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await deleteBillAction(id);
    });
  }

  const totals = computeTotals(buffer);
  const billOpen = selectedId != null;

  const inputCls =
    "rounded border border-accent-dim bg-black px-1.5 py-1 text-sm text-foreground outline-none focus:border-accent";

  return (
    <div className="flex h-full">
      {/* Bill rail */}
      <SideRail
        title="Bills"
        helpSection="guide-bills"
        footer={
          <>
            {creating ? (
              <input
                autoFocus
                className={`mt-1 ${inputCls}`}
                placeholder="Bill name (e.g. KLC dinner)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={submitNew}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNew();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="mt-1 rounded px-2 py-1 text-left font-mono text-xs text-foreground/50 hover:bg-accent-dim hover:text-accent-bright"
              >
                + Bill
              </button>
            )}
            {isPreview && creating && (
              <label className="flex items-center gap-1 px-1 text-[10px] text-foreground/50">
                <input
                  type="checkbox"
                  checked={newTest}
                  onChange={(e) => setNewTest(e.target.checked)}
                />
                test
              </label>
            )}
          </>
        }
      >
        {bills.map((b) => (
          <div key={b.id} className="group flex items-center">
            <button
              onClick={() => selectBill(b.id)}
              className={`flex-1 truncate rounded px-2 py-1 text-left text-sm ${
                selectedId === b.id
                  ? "bg-accent-dim text-accent-bright"
                  : "text-foreground/70 hover:bg-accent-dim/40 hover:text-foreground"
              }`}
            >
              {b.name}
              {b.isTest && (
                <span className="ml-1 rounded bg-accent-dim px-1 font-mono text-[10px] text-accent-bright">
                  test
                </span>
              )}
            </button>
            <button
              onClick={() => removeBill(b.id)}
              aria-label={`Delete ${b.name}`}
              className="shrink-0 px-1 text-foreground/40 opacity-100 hover:text-accent-bright sm:opacity-0 sm:group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </SideRail>

      {/* Editor */}
      {!billOpen ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-xs text-foreground/40">
          Pick a bill, or “+ Bill”. Add people and items, set each person’s
          share per item; totals compute live.
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden p-3">
          {/* toolbar */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} flex-1 min-w-[8rem] font-mono text-sm uppercase tracking-wide text-accent-bright`}
              value={name}
              onChange={(e) => commit(buffer, e.target.value)}
              placeholder="Bill name"
            />
            <button
              onClick={addParticipant}
              className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright"
            >
              + Person
            </button>
            <button
              onClick={addItem}
              className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright"
            >
              + Item
            </button>
            <ReceiptScanner onAdd={addScanned} defaultTax={lastTax()} />
            <span className="font-mono text-[10px] text-foreground/40">
              {dirty ? "saving…" : "saved"}
            </span>
          </div>

          {/* bulk-delete toolbar */}
          {selected.size > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded border border-accent bg-accent-dim/30 px-2 py-1 text-xs">
              <span className="font-mono text-accent-bright">
                {selected.size} selected
              </span>
              <button
                onClick={deleteSelected}
                className="rounded bg-accent px-2 py-0.5 font-mono font-medium text-black hover:bg-accent-bright"
              >
                Delete
              </button>
              <button
                onClick={cancelSelect}
                className="ml-auto font-mono text-foreground/60 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}

          {/* grid */}
          <div
            ref={gridRef}
            onKeyDown={onGridKey}
            className="min-h-0 flex-1 overflow-auto"
          >
            <table className="border-collapse text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-foreground/50">
                  {/* select column: always on desktop, on mobile only while
                      selecting (WhatsApp-style) */}
                  <th
                    className={`px-1 py-1 ${selecting ? "" : "hidden"} sm:table-cell`}
                  >
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        buffer.items.length > 0 &&
                        selected.size === buffer.items.length
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? new Set(buffer.items.map((it) => it.id))
                            : new Set()
                        )
                      }
                    />
                  </th>
                  <th className="sticky left-0 z-10 bg-background px-2 py-1 text-left">
                    Item
                  </th>
                  <th className="px-1 py-1">Cost</th>
                  <th className="px-1 py-1">Tax%</th>
                  {buffer.participants.map((p) => (
                    <th key={p.id} className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <input
                          className={`${inputCls} w-16`}
                          value={p.name}
                          placeholder="name"
                          onChange={(e) => setParticipantName(p.id, e.target.value)}
                        />
                        <button
                          onClick={() => removeParticipant(p.id)}
                          aria-label={`Remove ${p.name || "person"}`}
                          className="px-0.5 text-foreground/40 hover:text-accent-bright"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                  {buffer.participants.length === 0 && (
                    <th className="px-2 py-1 font-normal normal-case text-foreground/40">
                      add people →
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {buffer.items.map((it, idx) => (
                  <tr
                    key={it.id}
                    className={`border-t border-accent-dim/50 ${
                      selected.has(it.id) ? "bg-accent-dim/20" : ""
                    }`}
                  >
                    <td
                      className={`px-1 py-1 text-center ${selecting ? "" : "hidden"} sm:table-cell`}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select item"
                        checked={selected.has(it.id)}
                        onChange={() => toggleSelect(it.id)}
                      />
                    </td>
                    <td className="sticky left-0 z-10 bg-background px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <input
                          data-row={idx}
                          data-col="name"
                          className={`${inputCls} w-32`}
                          value={it.name}
                          placeholder="item"
                          onChange={(e) => setItem(it.id, { name: e.target.value })}
                        />
                        {/* mobile: delete enters bulk-select mode */}
                        <button
                          onClick={() => enterSelect(it.id)}
                          aria-label="Remove item"
                          className="px-0.5 text-foreground/40 hover:text-accent-bright sm:hidden"
                        >
                          ✕
                        </button>
                        {/* desktop: delete removes just this item */}
                        <button
                          onClick={() => removeItem(it.id)}
                          aria-label="Remove item"
                          className="hidden px-0.5 text-foreground/40 hover:text-accent-bright sm:inline"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                    <td className={`px-1 py-1 ${inSel(idx, "cost") ? "bg-accent-dim/40" : ""}`}>
                      <input
                        data-row={idx}
                        data-col="cost"
                        inputMode="decimal"
                        className={`${inputCls} w-16 text-right`}
                        value={it.cost}
                        placeholder="0.00"
                        onChange={(e) => setItem(it.id, { cost: e.target.value })}
                      />
                    </td>
                    <td className={`px-1 py-1 ${inSel(idx, "tax") ? "bg-accent-dim/40" : ""}`}>
                      <input
                        data-row={idx}
                        data-col="tax"
                        inputMode="decimal"
                        className={`${inputCls} w-12 text-right`}
                        value={it.taxPercent}
                        placeholder="0"
                        onChange={(e) => setItem(it.id, { taxPercent: e.target.value })}
                      />
                    </td>
                    {buffer.participants.map((p) => (
                      <td
                        key={p.id}
                        className={`px-1 py-1 text-center ${
                          inSel(idx, `share:${p.id}`) ? "bg-accent-dim/40" : ""
                        }`}
                      >
                        <input
                          data-row={idx}
                          data-col={`share:${p.id}`}
                          inputMode="numeric"
                          className={`${inputCls} w-10 text-center`}
                          value={it.shares[p.id] ? String(it.shares[p.id]) : ""}
                          placeholder="·"
                          onChange={(e) => setShare(it.id, p.id, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {buffer.items.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-3 font-mono text-xs text-foreground/40"
                      colSpan={4 + Math.max(1, buffer.participants.length)}
                    >
                      No items yet — “+ Item”, or “Scan receipt”.
                    </td>
                  </tr>
                )}
              </tbody>
              {buffer.participants.length > 0 && buffer.items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-accent bg-black font-mono">
                    <td
                      className={`px-1 py-1.5 ${selecting ? "" : "hidden"} sm:table-cell`}
                    />
                    <td className="sticky left-0 z-10 bg-black px-2 py-1.5 text-[10px] uppercase tracking-wide text-accent-bright">
                      Owed
                    </td>
                    <td className="px-1 py-1.5 text-right text-xs text-foreground/50" colSpan={2}>
                      {money(totals.grand)}
                    </td>
                    {buffer.participants.map((p) => (
                      <td
                        key={p.id}
                        className="px-1 py-1.5 text-center text-xs text-accent-bright"
                      >
                        {money(totals.perParticipant[p.id] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {totals.unallocated > 0 && (
            <p className="mt-2 font-mono text-[10px] text-foreground/40">
              {money(totals.unallocated)} on items with nobody assigned (not in
              anyone’s total yet).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
