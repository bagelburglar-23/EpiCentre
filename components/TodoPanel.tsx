"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  addTodoAction,
  updateTodoAction,
  toggleTodoAction,
  deleteTodoAction,
} from "@/app/todo/actions";
import type { Todo } from "@/lib/todos";

function isOverdue(dueDate: string | null, done: boolean): boolean {
  if (!dueDate || done) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// A line starting with -, *, • or – (iOS sometimes swaps "-" for a dash)
// followed by a space is a bullet. Consecutive bullets become one <ul>;
// every other line is its own paragraph, so line breaks survive too.
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

type Fields = { title: string; details: string; dueDate: string };

// One modal for both "new" and "edit": `initial` present = edit mode.
function EntryModal({
  isPreview,
  initial,
  onClose,
  onSubmit,
}: {
  isPreview: boolean;
  initial?: Fields;
  onClose: () => void;
  onSubmit: (f: Fields, isTest: boolean) => void;
}) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [addAsTest, setAddAsTest] = useState(false);

  function submit() {
    if (!title.trim()) return;
    onSubmit({ title, details, dueDate }, addAsTest);
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

export default function TodoPanel({
  initialTodos,
  isPreview,
}: {
  initialTodos: Todo[];
  isPreview: boolean;
}) {
  const [todos, setTodos] = useState(initialTodos);
  // null = closed, "new" = add modal, a Todo = edit modal for that item.
  const [modal, setModal] = useState<null | "new" | Todo>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  // After each server action, revalidatePath("/") sends fresh props from
  // the server. useState only reads its argument on first render, so
  // without this the list would keep the optimistic copy - including the
  // fake negative id of a just-added item, which then can't be edited.
  // React idiom: "adjusting state when a prop changes" - compare against the
  // previous prop during render instead of in a useEffect.
  const [prevInitial, setPrevInitial] = useState(initialTodos);
  if (initialTodos !== prevInitial) {
    setPrevInitial(initialTodos);
    setTodos(initialTodos);
  }

  function add(f: Fields, isTest: boolean) {
    const optimistic: Todo = {
      id: -Date.now(),
      title: f.title.trim(),
      details: f.details.trim() || null,
      dueDate: f.dueDate || null,
      done: false,
      isTest: isPreview && isTest,
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      await addTodoAction(f.title, f.details, f.dueDate, isPreview && isTest);
    });
  }

  function save(id: number, f: Fields) {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: f.title.trim(),
              details: f.details.trim() || null,
              dueDate: f.dueDate || null,
            }
          : t
      )
    );
    startTransition(async () => {
      await updateTodoAction(id, f.title, f.details, f.dueDate);
    });
  }

  function toggle(id: number) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    startTransition(async () => {
      await toggleTodoAction(id);
    });
  }

  function remove(id: number) {
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

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
          To-Do
        </h1>
        <button
          onClick={() => setModal("new")}
          className="rounded bg-accent px-2.5 py-1 font-mono text-xs font-medium text-black hover:bg-accent-bright"
        >
          + Add
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {todos.map((t) => {
          const open = expanded.has(t.id);
          const pending = t.id < 0; // optimistic, not yet saved
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
                  {/* Tap the title to edit */}
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
                onClick={() => remove(t.id)}
                aria-label="Delete"
                className="shrink-0 rounded px-1.5 py-0.5 text-foreground/40 hover:bg-accent-dim hover:text-accent-bright"
              >
                ✕
              </button>
            </li>
          );
        })}
        {todos.length === 0 && (
          <li className="font-mono text-xs text-foreground/40">Nothing yet.</li>
        )}
      </ul>
      {modal === "new" && (
        <EntryModal
          isPreview={isPreview}
          onClose={() => setModal(null)}
          onSubmit={add}
        />
      )}
      {modal && modal !== "new" && (
        <EntryModal
          key={modal.id}
          isPreview={isPreview}
          initial={{
            title: modal.title,
            details: modal.details ?? "",
            dueDate: modal.dueDate ?? "",
          }}
          onClose={() => setModal(null)}
          onSubmit={(f) => save(modal.id, f)}
        />
      )}
    </div>
  );
}
