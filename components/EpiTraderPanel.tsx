// Placeholder shell. No interactivity yet, so this is a plain server
// component (no "use client", no JS shipped). EpiTrader will eventually
// surface a read-only view of a PERSONAL portfolio (IBKR + an external
// portfolio system Lucas is building separately).
//
// D-08 boundary: this module is for Lucas's own personal trading only.
// Nothing from the bank's book - positions, sizes, client flow, P&L -
// ever lands in EpiCentre. That line is drawn here on purpose.

import HelpButton from "@/components/HelpButton";

export default function EpiTraderPanel() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
          EpiTrader
        </h1>
        <HelpButton section="guide-epitrader" />
      </div>
      <p className="mb-4 text-sm text-foreground/60">
        Empty shell — nothing wired up yet.
      </p>

      <div className="space-y-4 text-sm text-foreground/70">
        <p>
          Planned home for a read-only view of your{" "}
          <span className="text-foreground">personal</span> portfolio: a link
          to IBKR and to the portfolio-management system you&apos;re building
          outside this project.
        </p>
        <div className="rounded border border-accent-dim bg-black p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-accent-bright">
            Boundary (D-08)
          </div>
          <p className="text-xs text-foreground/60">
            Personal trading only. No desk/book content — positions, sizes,
            client flow, or P&amp;L from work — is ever stored or shown here.
          </p>
        </div>
      </div>
    </div>
  );
}
