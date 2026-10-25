"use client";

import { useEffect, useState, type ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  content: ReactNode;
};

const STORAGE_KEY = "epicentre.openTabs";

type StoredState = { openTabs: string[]; activeTab: string | null };

export default function Shell({ items }: { items: NavItem[] }) {
  // Starts empty to match the server-rendered markup (localStorage isn't
  // available during SSR) - the real state loads in the effect below, once
  // hydrated. This intentionally means a brief flash of "nothing open" on
  // load rather than a hydration mismatch.
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredState;
        const validIds = new Set(items.map((i) => i.id));
        const restoredTabs = stored.openTabs.filter((id) => validIds.has(id));
        setOpenTabs(restoredTabs);
        setActiveTab(
          stored.activeTab && restoredTabs.includes(stored.activeTab)
            ? stored.activeTab
            : restoredTabs[restoredTabs.length - 1] ?? null
        );
      }
    } catch {
      // localStorage unavailable or corrupt - just start empty, not fatal.
    }
    setLoaded(true);
    // items' identity changes every render (content is JSX built fresh
    // server-side each time) - only id/label matter here, and those are
    // stable for a given deploy, so this intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return; // don't clobber storage with the initial empty state
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ openTabs, activeTab }));
    } catch {
      // storage full/unavailable - tabs just won't persist this time.
    }
  }, [openTabs, activeTab, loaded]);

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
      <nav className="flex w-11 flex-col items-center gap-1 border-r border-accent-dim bg-black py-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => openTab(item.id)}
            title={item.label}
            className={`flex h-8 w-8 items-center justify-center rounded font-mono text-xs font-medium ${
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
        {/* Tab bar - VS Code style, client-only state persisted to
            localStorage (see state/decisions.md): closing a tab just
            removes it from this list, nothing is destroyed server-side. */}
        {openTabs.length > 0 && (
          <div className="flex items-stretch border-b border-accent-dim bg-black">
            {openTabs.map((id) => (
              <div
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex cursor-pointer items-center gap-1.5 border-r border-accent-dim px-2.5 py-1.5 font-mono text-xs ${
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
            <div className="flex h-full items-center justify-center font-mono text-xs text-foreground/30">
              Select something from the sidebar to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
