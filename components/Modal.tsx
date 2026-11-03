"use client";

import { type ReactNode } from "react";

// Shared modal shell: a dimmed backdrop (click to close) and a centred card
// that stops click propagation. One place for the overlay look - modals pass
// their own content as children, and an optional className tweaks the card
// (e.g. a wider max-width). Used across the app's modals.
export default function Modal({
  onClose,
  children,
  className = "",
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20"
      onClick={onClose}
    >
      <div
        className={`mx-3 w-full max-w-sm rounded border border-accent-dim bg-black p-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
