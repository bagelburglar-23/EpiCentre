"use client";

import { useState, type ReactNode } from "react";
import HelpButton from "@/components/HelpButton";

// The one shared left rail used by EpiList, EpiSplit and Settings (and any
// future module that wants one). It owns the chrome - fixed width, collapse
// toggle, title, the module's "?" help link, and a footer slot - while each
// module renders its own entries as children. Change the rail here once and
// every module that uses it updates together.
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
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <aside className="flex w-8 shrink-0 flex-col items-center border-r border-accent-dim bg-black py-2">
        <button
          onClick={() => setOpen(true)}
          aria-label={`Expand ${title}`}
          title={title}
          className="rounded px-1 font-mono text-sm text-foreground/50 hover:text-accent-bright"
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r border-accent-dim bg-black p-2">
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
      {children}
      {footer}
    </aside>
  );
}
