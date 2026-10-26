"use client";

import { useState, type InputHTMLAttributes } from "react";

// Shared across login + settings forms rather than duplicated - same
// "shared code lives outside any one page" reasoning as Shell.tsx, just at
// component scope rather than lib/ (no DB/server logic here to put there).
export default function PasswordInput(
  props: InputHTMLAttributes<HTMLInputElement>
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full pr-12 ${props.className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 px-2.5 font-mono text-[10px] uppercase text-foreground/40 hover:text-accent-bright"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
