"use client";

import { useState, useTransition } from "react";
import {
  addTodoAction,
  toggleTodoAction,
  deleteTodoAction,
} from "@/app/todo/actions";
import type { Todo } from "@/lib/todos";

export default function TodoPanel({
  initialTodos,
  isPreview,
}: {
  initialTodos: Todo[];
  isPreview: boolean;
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [draft, setDraft] = useState("");
  const [addAsTest, setAddAsTest] = useState(false);
  const [, startTransition] = useTransition();

  function add() {
    const text = draft.trim();
    if (!text) return;
    const optimistic: Todo = {
      id: -Date.now(),
      text,
      done: false,
      isTest: isPreview && addAsTest,
    };
    setTodos((prev) => [...prev, optimistic]);
    setDraft("");
    startTransition(async () => {
      await addTodoAction(text, isPreview && addAsTest);
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
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold text-accent-bright">To-Do</h1>
      <div className="mb-3 flex gap-2">
        <input
          className="flex-1 rounded border border-accent-dim bg-black px-3 py-2 text-foreground outline-none focus:border-accent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an item..."
        />
        <button
          onClick={add}
          className="rounded bg-accent px-4 py-2 font-medium text-black hover:bg-accent-bright"
        >
          Add
        </button>
      </div>
      {isPreview && (
        <label className="mb-4 flex items-center gap-2 text-sm text-foreground/60">
          <input
            type="checkbox"
            checked={addAsTest}
            onChange={(e) => setAddAsTest(e.target.checked)}
          />
          Add as test (UAT only - won&apos;t appear on production)
        </label>
      )}
      <ul className="flex flex-col gap-2">
        {todos.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded border border-accent-dim bg-black px-3 py-2"
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              className="h-4 w-4 shrink-0"
            />
            <span
              className={`flex-1 ${
                t.done ? "text-foreground/40 line-through" : "text-foreground"
              }`}
            >
              {t.text}
              {t.isTest && (
                <span className="ml-2 rounded bg-accent-dim px-1.5 py-0.5 text-xs text-accent-bright">
                  test
                </span>
              )}
            </span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Delete"
              className="shrink-0 rounded px-2 py-1 text-foreground/40 hover:bg-accent-dim hover:text-accent-bright"
            >
              ✕
            </button>
          </li>
        ))}
        {todos.length === 0 && (
          <li className="text-sm text-foreground/40">Nothing yet.</li>
        )}
      </ul>
    </div>
  );
}
