// Tiny client-side navigation bus. Lets a panel ask the Shell to open another
// tab, optionally at a named section that the target tab's panel scrolls to
// when it mounts. Avoids threading tab-control callbacks through every module
// (which would be the shell knowing about modules' internals - the opposite
// of the module contract). Everything here is browser-only.

let pendingSection: string | null = null;

export function navigateTo(tab: string, section?: string): void {
  if (typeof window === "undefined") return;
  pendingSection = section ?? null;
  window.dispatchEvent(
    new CustomEvent("epicentre:navigate", { detail: { tab, section } })
  );
}

// Read-and-clear the section a navigateTo() requested, for the target panel
// to consume once on mount.
export function consumePendingSection(): string | null {
  const s = pendingSection;
  pendingSection = null;
  return s;
}
