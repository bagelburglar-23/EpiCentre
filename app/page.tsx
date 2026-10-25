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
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-md">
        <h1 className="mb-6 text-2xl font-semibold text-accent-bright">
          EpiCentre — smoke test
        </h1>
        <p className="mb-6 text-sm text-foreground/60">
          Plain in-memory to-do list. Resets on page reload — this is only
          here to confirm edits deploy correctly, not a real feature yet.
          Accent color above/below reflects PROD (red) vs UAT pending
          review (blue) vs UAT in sync (grey).
        </p>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border border-accent-dim bg-black px-3 py-2 text-foreground outline-none focus:border-accent"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add an item..."
          />
          <button
            onClick={addItem}
            className="rounded bg-accent px-4 py-2 font-medium text-black hover:bg-accent-bright"
          >
            Add
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded border border-accent-dim bg-black px-3 py-2 text-foreground"
            >
              {item}
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-foreground/40">Nothing yet.</li>
          )}
        </ul>
      </main>
    </div>
  );
}
