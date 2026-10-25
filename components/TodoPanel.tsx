"use client";

import { useState, useTransition } from "react";
import {
  addTodoAction,
  toggleTodoAction,
  deleteTodoAction,
} from "@/app/todo/actions";
import type { Todo } from "@/lib/todos";

function isOverdue(dueDate: string | null, done: boolean): boolean {
  if (!dueDate || done) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function EntryModal({
  isPreview,
  onClose,
  onSubmit,
}: {
  isPreview: boolean;
  onClose: () => void;
  onSubmit: (title: string, details: string, dueDate: string, isTest: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [addAsTest, setAddAsTest] = useState(false);

  function submit() {
    if (!title.trim()) return;
    onSubmit(title, details, dueDate, addAsTest);
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
          New item
        </h2>
        <div className="flex flex-col gap-2.5">
          <input
            autoFocus
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          />
          <textarea
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Details (optional)"
            rows={3}
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
          {isPreview && (
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
            Add
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
  const [modalOpen, setModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  function add(title: string, details: string, dueDate: string, isTest: boolean) {
    const optimistic: Todo = {
      id: -Date.now(),
      title: title.trim(),
      details: details.trim() || null,
      dueDate: dueDate || null,
      done: false,
      isTest: isPreview && isTest,
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      await addTodoAction(title, details, dueDate, isPreview && isTest);
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

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
          To-Do
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded bg-accent px-2.5 py-1 font-mono text-xs font-medium text-black hover:bg-accent-bright"
        >
          + Add
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {todos.map((t) => (
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
              <div
                className={`text-sm ${
                  t.done ? "text-foreground/40 line-through" : "text-foreground"
                }`}
              >
                {t.title}
                {t.isTest && (
                  <span className="ml-2 rounded bg-accent-dim px-1 py-0.5 font-mono text-[10px] text-accent-bright">
                    test
                  </span>
                )}
              </div>
              {t.details && (
                <div className="text-xs text-foreground/50">{t.details}</div>
              )}
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
        ))}
        {todos.length === 0 && (
          <li className="font-mono text-xs text-foreground/40">Nothing yet.</li>
        )}
      </ul>
      {modalOpen && (
        <EntryModal
          isPreview={isPreview}
          onClose={() => setModalOpen(false)}
          onSubmit={add}
        />
      )}
    </div>
  );
}
