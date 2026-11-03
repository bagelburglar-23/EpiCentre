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
import HelpButton from "@/components/HelpButton";
import ReceiptScanner from "@/components/ReceiptScanner";
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
  const [railOpen, setRailOpen] = useState(true);
  // Bulk delete: `selected` item ids; `selecting` only toggles the checkbox
  // column's visibility on mobile (desktop shows it always).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
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
  // New items inherit the last item's tax % (one place usually has one rate),
  // so you don't retype it every row.
  const lastTax = () => buffer.items[buffer.items.length - 1]?.taxPercent ?? "";
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
    gridRef.current
      ?.querySelector<HTMLInputElement>(
        `input[data-row="${row}"][data-col="${col}"]`
      )
      ?.focus();
  }
  function fillColumn(col: string, value: string) {
    if (col === "cost") {
      commit({ ...buffer, items: buffer.items.map((it) => ({ ...it, cost: value })) });
    } else if (col === "tax") {
      commit({
        ...buffer,
        items: buffer.items.map((it) => ({ ...it, taxPercent: value })),
      });
    } else if (col.startsWith("share:")) {
      const pid = col.slice(6);
      const n = value === "" ? 0 : Math.max(0, Math.floor(Number(value) || 0));
      commit({
        ...buffer,
        items: buffer.items.map((it) => ({
          ...it,
          shares: { ...it.shares, [pid]: n },
        })),
      });
    }
  }
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const t = e.target as HTMLElement;
    const col = t.dataset.col;
    const row = Number(t.dataset.row);
    if (!col || Number.isNaN(row)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(e.key === "ArrowDown" ? buffer.items.length - 1 : 0, col);
    } else if (e.key.toLowerCase() === "d") {
      // Ctrl/Cmd+D: fill this column with the focused cell's value (fast way
      // to set one tax rate down the whole bill).
      e.preventDefault();
      fillColumn(col, (t as HTMLInputElement).value ?? "");
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
      {railOpen ? (
      <aside className="flex w-36 shrink-0 flex-col gap-1 border-r border-accent-dim bg-black p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
            Bills
          </h1>
          <div className="flex items-center gap-1">
            <HelpButton section="guide-bills" />
            <button
              onClick={() => setRailOpen(false)}
              aria-label="Collapse bills"
              title="Collapse"
              className="rounded px-1 text-foreground/40 hover:text-accent-bright"
            >
              ‹
            </button>
          </div>
        </div>
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
      </aside>
      ) : (
        <aside className="flex w-8 shrink-0 flex-col items-center border-r border-accent-dim bg-black py-2">
          <button
            onClick={() => setRailOpen(true)}
            aria-label="Expand bills"
            title="Bills"
            className="rounded px-1 font-mono text-sm text-foreground/50 hover:text-accent-bright"
          >
            ›
          </button>
        </aside>
      )}

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
                    <td className="px-1 py-1">
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
                    <td className="px-1 py-1">
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
                      <td key={p.id} className="px-1 py-1 text-center">
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
