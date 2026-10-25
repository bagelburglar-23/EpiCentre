"use client";

import { useState } from "react";

export default function Home() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  function addItem() {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [...prev, text]);
    setDraft("");
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-md">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
          EpiCentre — smoke test
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Plain in-memory to-do list. Resets on page reload — this is only
          here to confirm edits deploy correctly, not a real feature yet.
        </p>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add an item..."
          />
          <button
            onClick={addItem}
            className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
          >
            Add
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded border border-zinc-200 bg-white px-3 py-2 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              {item}
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-zinc-400">Nothing yet.</li>
          )}
        </ul>
      </main>
    </div>
  );
}
