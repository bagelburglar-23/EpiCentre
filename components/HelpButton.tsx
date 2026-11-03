"use client";

import { navigateTo } from "@/lib/nav-bus";

// A small "?" that opens EpiDev at this module's guide section.
export default function HelpButton({ section }: { section: string }) {
  return (
    <button
      onClick={() => navigateTo("developer", section)}
      aria-label="Open this module's guide in EpiDev"
      title="Guide"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent-dim font-mono text-xs text-foreground/50 hover:border-accent hover:text-accent-bright"
    >
      ?
    </button>
  );
}
