"use client";

import { useState, type ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export default function Shell({ items }: { items: NavItem[] }) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  function openTab(id: string) {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTab(id);
  }

  function closeTab(id: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      setActiveTab((current) =>
        current === id ? next[next.length - 1] ?? null : current
      );
      return next;
    });
  }

  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar - always visible, lists everything available */}
      <nav className="flex w-14 flex-col items-center gap-1 border-r border-accent-dim bg-black py-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => openTab(item.id)}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded text-sm font-medium ${
              activeTab === item.id
                ? "bg-accent text-black"
                : "text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
            }`}
          >
            {item.label.slice(0, 1)}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 flex-col">
        {/* Tab bar - VS Code style, client-only state (see state/decisions.md
            on this choice): closing a tab just removes it from this list,
            nothing is destroyed server-side. */}
        {openTabs.length > 0 && (
          <div className="flex items-stretch border-b border-accent-dim bg-black">
            {openTabs.map((id) => (
              <div
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex cursor-pointer items-center gap-2 border-r border-accent-dim px-3 py-2 text-sm ${
                  activeTab === id
                    ? "bg-accent-dim text-accent-bright"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                <span>{byId[id]?.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(id);
                  }}
                  aria-label={`Close ${byId[id]?.label}`}
                  className="rounded px-1 hover:bg-accent hover:text-black"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-auto bg-background">
          {activeTab ? (
            byId[activeTab]?.content
          ) : (
            <div className="flex h-full items-center justify-center text-foreground/30">
              Select something from the sidebar to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
