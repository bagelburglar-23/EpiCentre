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
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  function addItem() {
    commit({
      ...buffer,
      items: [
        ...buffer.items,
        { id: uid(), name: "", cost: "", taxPercent: "", shares: {} },
      ],
    });
  }
  function removeItem(itemId: string) {
    commit({ ...buffer, items: buffer.items.filter((it) => it.id !== itemId) });
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
  const selected = selectedId != null;

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
              className="shrink-0 px-1 text-foreground/40 opacity-0 hover:text-accent-bright group-hover:opacity-100"
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
      {!selected ? (
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
            <span className="font-mono text-[10px] text-foreground/40">
              {dirty ? "saving…" : "saved"}
            </span>
          </div>

          {/* grid */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-foreground/50">
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
                {buffer.items.map((it) => (
                  <tr key={it.id} className="border-t border-accent-dim/50">
                    <td className="sticky left-0 z-10 bg-background px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <input
                          className={`${inputCls} w-32`}
                          value={it.name}
                          placeholder="item"
                          onChange={(e) => setItem(it.id, { name: e.target.value })}
                        />
                        <button
                          onClick={() => removeItem(it.id)}
                          aria-label="Remove item"
                          className="px-0.5 text-foreground/40 hover:text-accent-bright"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        inputMode="decimal"
                        className={`${inputCls} w-16 text-right`}
                        value={it.cost}
                        placeholder="0.00"
                        onChange={(e) => setItem(it.id, { cost: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
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
                      colSpan={3 + Math.max(1, buffer.participants.length)}
                    >
                      No items yet — “+ Item”.
                    </td>
                  </tr>
                )}
              </tbody>
              {buffer.participants.length > 0 && buffer.items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-accent bg-black font-mono">
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
