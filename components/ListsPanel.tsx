"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  addTodoAction,
  updateTodoAction,
  toggleTodoAction,
  deleteTodoAction,
} from "@/app/todo/actions";
import {
  createListAction,
  renameListAction,
  deleteListAction,
} from "@/app/lists/actions";
import type { Todo } from "@/lib/todos";
import type { List } from "@/lib/lists";
import SideRail from "@/components/SideRail";

function isOverdue(dueDate: string | null, done: boolean): boolean {
  if (!dueDate || done) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// A line starting with -, *, • or – followed by a space is a bullet;
// consecutive bullets become one <ul>, every other line its own paragraph.
const BULLET = /^\s*[-*•–]\s+/;

function Details({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="ml-4 list-disc">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  for (const line of text.split("\n")) {
    if (BULLET.test(line)) {
      bullets.push(line.replace(BULLET, ""));
    } else {
      flush();
      blocks.push(
        line.trim() ? (
          <p key={blocks.length}>{line}</p>
        ) : (
          <div key={blocks.length} className="h-2" />
        )
      );
    }
  }
  flush();
  return <div className="mt-1 text-xs text-foreground/60">{blocks}</div>;
}

type Fields = {
  title: string;
  details: string;
  dueDate: string;
  listId: number | null;
};

function EntryModal({
  lists,
  isPreview,
  initial,
  defaultListId,
  onClose,
  onSubmit,
}: {
  lists: List[];
  isPreview: boolean;
  initial?: Fields;
  defaultListId: number | null;
  onClose: () => void;
  onSubmit: (f: Fields, isTest: boolean) => void;
}) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [listId, setListId] = useState<number | null>(
    initial ? initial.listId : defaultListId
  );
  const [addAsTest, setAddAsTest] = useState(false);

  function submit() {
    if (!title.trim()) return;
    onSubmit({ title, details, dueDate, listId }, addAsTest);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded border border-accent-dim bg-black p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-accent-bright">
          {editing ? "Edit item" : "New item"}
        </h2>
        <div className="flex flex-col gap-2.5">
          <input
            autoFocus={!editing}
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          />
          <textarea
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder={"Details (optional)\n- start a line with - for a bullet"}
            rows={editing ? 6 : 3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <label className="flex items-center justify-between gap-2 text-xs text-foreground/60">
            List
            <select
              className="rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
              value={listId ?? ""}
              onChange={(e) =>
                setListId(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Dump</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-foreground/60">
            Due date
            <input
              type="date"
              className="rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          {isPreview && !editing && (
            <label className="flex items-center gap-2 text-xs text-foreground/60">
              <input
                type="checkbox"
                checked={addAsTest}
                onChange={(e) => setAddAsTest(e.target.checked)}
              />
              Add as test (UAT only)
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 font-mono text-xs text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-medium text-black hover:bg-accent-bright"
          >
            {editing ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListsPanel({
  initialLists,
  initialTodos,
  isPreview,
}: {
  initialLists: List[];
  initialTodos: Todo[];
  isPreview: boolean;
}) {
  const [lists, setLists] = useState(initialLists);
  const [todos, setTodos] = useState(initialTodos);

  // "Adjust state when a prop changes": after each action, revalidatePath("/")
  // sends fresh server props; adopt them so optimistic copies (and the fake
  // negative ids of just-added rows) are replaced by the real data.
  const [prevLists, setPrevLists] = useState(initialLists);
  if (initialLists !== prevLists) {
    setPrevLists(initialLists);
    setLists(initialLists);
  }
  const [prevTodos, setPrevTodos] = useState(initialTodos);
  if (initialTodos !== prevTodos) {
    setPrevTodos(initialTodos);
    setTodos(initialTodos);
  }

  const [selected, setSelected] = useState<number | null>(null); // null = Inbox
  const [modal, setModal] = useState<null | "new" | Todo>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListTest, setNewListTest] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingList, setDeletingList] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const visibleIds = new Set(lists.map((l) => l.id));
  // An item whose list was deleted (id no longer visible) falls back to Inbox.
  const effListId = (t: Todo) =>
    t.listId != null && visibleIds.has(t.listId) ? t.listId : null;
  const itemsFor = (listId: number | null) =>
    todos.filter((t) => effListId(t) === listId);
  const openCount = (listId: number | null) =>
    itemsFor(listId).filter((t) => !t.done).length;

  // Keep `selected` valid if its list disappears.
  if (selected !== null && !visibleIds.has(selected)) setSelected(null);

  // --- item ops (optimistic) ---
  function addItem(f: Fields, isTest: boolean) {
    const optimistic: Todo = {
      id: -Date.now(),
      title: f.title.trim(),
      details: f.details.trim() || null,
      dueDate: f.dueDate || null,
      done: false,
      isTest: isPreview && isTest,
      listId: f.listId,
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      await addTodoAction(f.title, f.details, f.dueDate, isPreview && isTest, f.listId);
    });
  }

  function saveItem(id: number, f: Fields) {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: f.title.trim(),
              details: f.details.trim() || null,
              dueDate: f.dueDate || null,
              listId: f.listId,
            }
          : t
      )
    );
    startTransition(async () => {
      await updateTodoAction(id, f.title, f.details, f.dueDate, f.listId);
    });
  }

  function toggle(id: number) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    startTransition(async () => {
      await toggleTodoAction(id);
    });
  }

  function removeItem(id: number) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteTodoAction(id);
    });
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // --- list ops (plain + revalidate) ---
  function submitNewList() {
    const name = newListName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    startTransition(async () => {
      await createListAction(name, isPreview && newListTest);
    });
    setNewListName("");
    setNewListTest(false);
    setCreating(false);
  }

  function submitRename(id: number) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    startTransition(async () => {
      await renameListAction(id, name);
    });
  }

  function doDeleteList(id: number, deleteItems: boolean) {
    setDeletingList(null);
    if (selected === id) setSelected(null);
    setLists((prev) => prev.filter((l) => l.id !== id));
    setTodos((prev) =>
      deleteItems
        ? prev.filter((t) => t.listId !== id)
        : prev.map((t) => (t.listId === id ? { ...t, listId: null } : t))
    );
    startTransition(async () => {
      await deleteListAction(id, deleteItems);
    });
  }

  const railItem = (id: number | null, name: string) => {
    const active = selected === id;
    return (
      <button
        key={id ?? "inbox"}
        onClick={() => setSelected(id)}
        className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${
          active
            ? "bg-accent-dim text-accent-bright"
            : "text-foreground/70 hover:bg-accent-dim/40 hover:text-foreground"
        }`}
      >
        <span className="truncate">{name}</span>
        <span className="shrink-0 font-mono text-[10px] text-foreground/40">
          {openCount(id) || ""}
        </span>
      </button>
    );
  };

  const items = itemsFor(selected);
  const currentName =
    selected === null ? "Dump" : lists.find((l) => l.id === selected)?.name ?? "Dump";
  const deletingObj =
    deletingList != null ? lists.find((l) => l.id === deletingList) : null;
  const deletingCount = deletingList != null ? itemsFor(deletingList).length : 0;

  return (
    <div className="flex h-full">
      {/* List rail */}
      <SideRail
        title="Lists"
        helpSection="guide-lists"
        footer={
          creating ? (
            <input
              autoFocus
              className="mt-1 w-full rounded border border-accent bg-black px-2 py-1 text-sm text-foreground outline-none"
              placeholder="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onBlur={submitNewList}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewList();
                if (e.key === "Escape") setCreating(false);
              }}
            />
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 rounded px-2 py-1 text-left font-mono text-xs text-foreground/50 hover:bg-accent-dim hover:text-accent-bright"
            >
              + List
            </button>
          )
        }
      >
        {railItem(null, "Dump")}
        {lists.map((l) =>
          renamingId === l.id ? (
            <input
              key={l.id}
              autoFocus
              className="w-full rounded border border-accent bg-black px-2 py-1 text-sm text-foreground outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => submitRename(l.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename(l.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <div key={l.id} className="group flex items-center">
              {railItem(l.id, l.name)}
              <div className="ml-0.5 flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  onClick={() => {
                    setRenamingId(l.id);
                    setRenameValue(l.name);
                  }}
                  aria-label={`Rename ${l.name}`}
                  className="rounded px-1 text-foreground/40 hover:text-accent-bright"
                >
                  ✎
                </button>
                <button
                  onClick={() => setDeletingList(l.id)}
                  aria-label={`Delete ${l.name}`}
                  className="rounded px-1 text-foreground/40 hover:text-accent-bright"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        )}
      </SideRail>

      {/* Items of the selected list */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="truncate font-mono text-sm uppercase tracking-wide text-accent-bright">
            {currentName}
          </h2>
          <button
            onClick={() => setModal("new")}
            className="shrink-0 rounded bg-accent px-2.5 py-1 font-mono text-xs font-medium text-black hover:bg-accent-bright"
          >
            + Add
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {items.map((t) => {
            const open = expanded.has(t.id);
            const pending = t.id < 0;
            return (
              <li
                key={t.id}
                className="flex items-start gap-2 rounded border border-accent-dim bg-black px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1">
                    <button
                      onClick={() => !pending && setModal(t)}
                      className={`flex-1 text-left text-sm ${
                        t.done ? "text-foreground/40 line-through" : "text-foreground"
                      }`}
                    >
                      {t.title}
                      {t.isTest && (
                        <span className="ml-2 rounded bg-accent-dim px-1 py-0.5 font-mono text-[10px] text-accent-bright">
                          test
                        </span>
                      )}
                    </button>
                    {t.details && (
                      <button
                        onClick={() => toggleExpanded(t.id)}
                        aria-label={open ? "Hide details" : "Show details"}
                        aria-expanded={open}
                        className="shrink-0 rounded px-1.5 font-mono text-xs text-foreground/40 hover:text-accent-bright"
                      >
                        {open ? "▾" : "▸"}
                      </button>
                    )}
                  </div>
                  {t.details && open && <Details text={t.details} />}
                  {t.dueDate && (
                    <div
                      className={`font-mono text-[10px] ${
                        isOverdue(t.dueDate, t.done)
                          ? "text-accent-bright"
                          : "text-foreground/40"
                      }`}
                    >
                      due {t.dueDate}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeItem(t.id)}
                  aria-label="Delete"
                  className="shrink-0 rounded px-1.5 py-0.5 text-foreground/40 hover:bg-accent-dim hover:text-accent-bright"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="font-mono text-xs text-foreground/40">Nothing here yet.</li>
          )}
        </ul>
      </div>

      {modal === "new" && (
        <EntryModal
          lists={lists}
          isPreview={isPreview}
          defaultListId={selected}
          onClose={() => setModal(null)}
          onSubmit={addItem}
        />
      )}
      {modal && modal !== "new" && (
        <EntryModal
          key={modal.id}
          lists={lists}
          isPreview={isPreview}
          defaultListId={selected}
          initial={{
            title: modal.title,
            details: modal.details ?? "",
            dueDate: modal.dueDate ?? "",
            listId: effListId(modal),
          }}
          onClose={() => setModal(null)}
          onSubmit={(f) => saveItem(modal.id, f)}
        />
      )}

      {deletingList != null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24"
          onClick={() => setDeletingList(null)}
        >
          <div
            className="w-full max-w-sm rounded border border-accent-dim bg-black p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-accent-bright">
              Delete list “{deletingObj?.name}”
            </h2>
            <p className="mb-4 text-sm text-foreground/70">
              {deletingCount > 0
                ? `It has ${deletingCount} item${deletingCount === 1 ? "" : "s"}. What should happen to them?`
                : "This list is empty."}
            </p>
            <div className="flex flex-col gap-2">
              {deletingCount > 0 ? (
                <>
                  <button
                    onClick={() => doDeleteList(deletingList, false)}
                    className="rounded border border-accent-dim px-3 py-2 text-left text-sm text-foreground hover:bg-accent-dim"
                  >
                    Move items to{" "}
                    <span className="text-accent-bright">Dump</span>, delete the
                    list
                  </button>
                  <button
                    onClick={() => doDeleteList(deletingList, true)}
                    className="rounded border border-accent-dim px-3 py-2 text-left text-sm text-foreground hover:bg-accent-dim"
                  >
                    Delete the list{" "}
                    <span className="text-accent-bright">and its items</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => doDeleteList(deletingList, true)}
                  className="rounded border border-accent-dim px-3 py-2 text-left text-sm text-foreground hover:bg-accent-dim"
                >
                  Delete the list
                </button>
              )}
              <button
                onClick={() => setDeletingList(null)}
                className="mt-1 rounded px-3 py-1.5 text-center font-mono text-xs text-foreground/60 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
