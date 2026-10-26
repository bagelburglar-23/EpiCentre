"use client";

import { useActionState, useRef } from "react";
import { changePasswordAction } from "@/app/settings/actions";

export default function SettingsPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean }, formData: FormData) => {
      const result = await changePasswordAction(formData);
      if (result.success) formRef.current?.reset();
      return result;
    },
    {}
  );

  return (
    <div className="flex h-full flex-col p-4">
      <h1 className="mb-3 font-mono text-sm uppercase tracking-wide text-accent-bright">
        Settings
      </h1>

      <form
        ref={formRef}
        action={formAction}
        className="flex max-w-xs flex-col gap-2.5 rounded border border-accent-dim bg-black p-4"
      >
        <h2 className="mb-1 font-mono text-xs uppercase tracking-wide text-foreground/60">
          Change password
        </h2>
        <input
          type="password"
          name="current"
          placeholder="Current password"
          required
          className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
        />
        <input
          type="password"
          name="next"
          placeholder="New password (min 8 characters)"
          required
          minLength={8}
          className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
        />
        <input
          type="password"
          name="confirm"
          placeholder="Confirm new password"
          required
          minLength={8}
          className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
        />
        {state.error && (
          <p className="font-mono text-xs text-accent-bright">{state.error}</p>
        )}
        {state.success && (
          <p className="font-mono text-xs text-foreground/60">
            Password changed. This applies immediately — you won't be logged out
            on this device, but other devices will need the new password next
            time they log in.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded bg-accent px-3 py-1.5 font-mono text-xs font-medium text-black hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Changing..." : "Change password"}
        </button>
      </form>

      <p className="mt-3 max-w-xs font-mono text-[10px] text-foreground/40">
        One password, shared by PROD and UAT. Changing it here works from any
        logged-in device — phone included — no SSH or VPS access needed.
      </p>
    </div>
  );
}
