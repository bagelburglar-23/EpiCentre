"use client";

import { useEffect, useState, type ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  // Sidebar/bottom-nav glyph. Falls back to the label's first letter; set it
  // where labels would collide (all EpiX modules start "Epi" -> "E").
  short?: string;
  // Pinned/utility item (Settings): stays fixed at the end of the nav while
  // the other modules scroll, and gets no mobile title bar.
  pinned?: boolean;
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
  const [draggedId, setDraggedId] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- restoring persisted UI
     state (open tabs) is only possible after mount: localStorage is not
     available during SSR, so this seeds state once on the client. */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loaded) return; // don't clobber storage with the initial empty state
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ openTabs, activeTab }));
    } catch {
      // storage full/unavailable - tabs just won't persist this time.
    }
  }, [openTabs, activeTab, loaded]);

  // A module's "?" (HelpButton) asks to open EpiDev via the nav bus; the
  // target panel reads the section itself. Functional setState -> no stale
  // closure, so the empty dep list is correct.
  useEffect(() => {
    function onNav(e: Event) {
      const id = (e as CustomEvent).detail?.tab as string | undefined;
      if (!id) return;
      setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveTab(id);
    }
    window.addEventListener("epicentre:navigate", onNav);
    return () => window.removeEventListener("epicentre:navigate", onNav);
  }, []);

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

  // Native HTML5 drag-and-drop (no library) - desktop tab bar only.
  function reorderTab(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== draggedId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedId);
      return next;
    });
  }

  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const glyph = (item: NavItem) => item.short ?? item.label.slice(0, 1);
  const scrollItems = items.filter((i) => !i.pinned);
  const pinnedItems = items.filter((i) => i.pinned);
  const activeItem = activeTab ? byId[activeTab] : null;
  // Mobile title bar: shown for content modules, not for the pinned utility
  // (Settings) or the empty state. When it's hidden, <main> takes the
  // status-bar clearance itself so content never sits under the notch/clock.
  const showTitleBar = !!activeItem && !activeItem.pinned;

  const navButton = (item: NavItem) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => openTab(item.id)}
        className={`flex shrink-0 flex-col items-center justify-center gap-0.5 py-1.5 font-mono text-[10px] ${
          active ? "text-accent-bright" : "text-foreground/50"
        }`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium ${
            active ? "bg-accent text-black" : ""
          }`}
        >
          {glyph(item)}
        </span>
        {/* Bottom nav drops the "Epi" prefix (EpiList -> List); the full
            name shows only in the mobile title bar. */}
        <span className="max-w-[4.5rem] truncate">
          {item.label.replace(/^Epi/, "")}
        </span>
      </button>
    );
  };

  // fixed inset-0 pins the whole app to the viewport like a native shell: the
  // page itself never scrolls or rubber-bands, only the inner <main> (and
  // other explicit scroll areas) do. The column flips to a row on sm+.
  return (
    <div className="fixed inset-0 flex w-full flex-col overflow-hidden overscroll-none sm:flex-row">
      {/* Desktop sidebar - replaced by the bottom nav on mobile. Pinned items
          (Settings) sit at the bottom, as most apps place settings. */}
      <nav className="hidden w-11 flex-col items-center gap-1 border-r border-accent-dim bg-black py-2 sm:flex">
        <button
          onClick={() => window.location.reload()}
          title="Refresh (reload for new data / updates)"
          aria-label="Refresh"
          className="mb-1 flex h-8 w-8 items-center justify-center rounded font-mono text-base text-foreground/50 hover:bg-accent-dim hover:text-accent-bright"
        >
          ↻
        </button>
        {scrollItems.map((item) => (
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
            {glyph(item)}
          </button>
        ))}
        {pinnedItems.length > 0 && (
          <div className="mt-auto flex flex-col items-center gap-1">
            {pinnedItems.map((item) => (
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
                {glyph(item)}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile title bar - names the current module and, crucially, clears
            the iOS status bar (safe-area-inset-top). Hidden on desktop. */}
        {showTitleBar && (
          <div
            className="flex items-center border-b border-accent-dim bg-black px-4 sm:hidden"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <span className="py-2.5 font-mono text-sm uppercase tracking-wide text-accent-bright">
              {activeItem?.label}
            </span>
          </div>
        )}

        {/* Desktop tab bar - VS Code style, persisted to localStorage. Hidden
            on mobile. Scrolls horizontally if the open tabs overflow. */}
        {openTabs.length > 0 && (
          <div className="hidden items-stretch overflow-x-auto border-b border-accent-dim bg-black sm:flex">
            {openTabs.map((id) => (
              <div
                key={id}
                draggable
                onDragStart={() => setDraggedId(id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  reorderTab(id);
                }}
                onClick={() => setActiveTab(id)}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-accent-dim px-2.5 py-1.5 font-mono text-xs ${
                  draggedId === id ? "opacity-40" : ""
                } ${
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

        <main
          className="min-h-0 flex-1 overflow-auto bg-background"
          // When the mobile title bar is hidden (Settings / empty state),
          // <main> clears the status bar itself. 0 on desktop (inset is 0).
          style={{ paddingTop: showTitleBar ? undefined : "env(safe-area-inset-top)" }}
        >
          {activeTab ? (
            byId[activeTab]?.content
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs text-foreground/30">
              Select something to get started.
            </div>
          )}
        </main>

        {/* Mobile bottom nav - the EpiX modules scroll; the pinned utility
            (Settings, ☰) stays fixed at the right. padding clears the iOS
            home indicator. */}
        <nav
          className="flex items-stretch border-t border-accent-dim bg-black sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex flex-1 items-stretch gap-1 overflow-x-auto overscroll-x-none px-1">
            {scrollItems.map((item) => (
              <div key={item.id} className="w-[4.5rem] shrink-0">
                {navButton(item)}
              </div>
            ))}
          </div>
          {/* Utility cluster (refresh + Settings) - tinted so the scrolling
              modules clearly end here instead of looking like a glitch. */}
          <div className="flex shrink-0 items-stretch border-l border-accent-dim bg-accent-dim/30">
            <button
              onClick={() => window.location.reload()}
              aria-label="Refresh"
              className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 font-mono text-[10px] text-foreground/60"
            >
              <span className="flex h-7 w-7 items-center justify-center text-base">
                ↻
              </span>
              <span>Refresh</span>
            </button>
            {pinnedItems.map((item) => (
              <div key={item.id} className="shrink-0 border-l border-accent-dim/60">
                {navButton(item)}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
