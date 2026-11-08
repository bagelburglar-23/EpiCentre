"use client";

import { useState, type ReactNode } from "react";
import HelpButton from "@/components/HelpButton";

// The one shared left rail used by EpiList, EpiSplit and Settings (and any
// future module that wants one). It owns the chrome - the module's title, its
// "?" help link, a footer slot - while each module renders its own entries as
// children. Change the rail here once and every module updates together.
//
// Two layouts, chosen by screen width with Tailwind's `sm:` breakpoint (no JS,
// so it's SSR-safe - no hydration flash):
//   - Desktop (>= sm): an inline 160px rail that collapses to a thin spine.
//   - Mobile  (<  sm): a slim ☰ launcher; tapping it opens a FULL-SCREEN menu
//     (like Instagram's) that takes over the display with a Close button,
//     instead of the old cramped half-width rail.
// The entries render in both layouts; CSS hides whichever isn't active, so at
// most one is ever visible (the standard "render twice, hide one" responsive
// menu pattern).
//
// Auto-close: picking a primary entry on mobile should dismiss the full-screen
// menu and drop you back on the content. A panel marks its primary buttons
// with `data-rail-close`; a delegated click handler on the menu catches the
// bubbled click and closes. Secondary controls (rename, delete, "+ New", an
// inline text input) are left unmarked, so they keep the menu open.
export default function SideRail({
  title,
  helpSection,
  children,
  footer,
}: {
  title: string;
  helpSection: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(true); // desktop: expanded vs collapsed spine
  const [mobileOpen, setMobileOpen] = useState(false); // mobile: full-screen menu

  const entries = (
    <>
      {children}
      {footer}
    </>
  );

  return (
    <>
      {/* ---------------- MOBILE (< sm) ---------------- */}
      {/* Slim launcher spine - the only rail chrome on a phone. */}
      <div className="flex w-9 shrink-0 flex-col items-center border-r border-accent-dim bg-black py-2 sm:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label={`Open ${title} menu`}
          title={title}
          className="rounded px-1 font-mono text-lg text-foreground/60 hover:text-accent-bright"
        >
          ☰
        </button>
      </div>
      {/* Full-screen takeover menu. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-black sm:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="flex items-center justify-between border-b border-accent-dim px-4 py-3">
            <h1 className="font-mono text-base uppercase tracking-wide text-accent-bright">
              {title}
            </h1>
            <div className="flex items-center gap-3">
              <HelpButton section={helpSection} />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded px-2 py-1 font-mono text-sm text-foreground/60 hover:text-accent-bright"
              >
                ✕ Close
              </button>
            </div>
          </div>
          <div
            className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-base"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-rail-close]")) {
                setMobileOpen(false);
              }
            }}
          >
            {entries}
          </div>
        </div>
      )}

      {/* ---------------- DESKTOP (>= sm) ---------------- */}
      {open ? (
        <aside className="hidden w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r border-accent-dim bg-black p-2 sm:flex">
          <div className="mb-1 flex items-center justify-between px-1">
            <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
              {title}
            </h1>
            <div className="flex items-center gap-1">
              <HelpButton section={helpSection} />
              <button
                onClick={() => setOpen(false)}
                aria-label={`Collapse ${title}`}
                title="Collapse"
                className="rounded px-1 text-foreground/40 hover:text-accent-bright"
              >
                ‹
              </button>
            </div>
          </div>
          {entries}
        </aside>
      ) : (
        <aside className="hidden w-8 shrink-0 flex-col items-center border-r border-accent-dim bg-black py-2 sm:flex">
          <button
            onClick={() => setOpen(true)}
            aria-label={`Expand ${title}`}
            title={title}
            className="rounded px-1 font-mono text-sm text-foreground/50 hover:text-accent-bright"
          >
            ›
          </button>
        </aside>
      )}
    </>
  );
}
