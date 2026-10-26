"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => loginAction(formData),
    {}
  );

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6">
      <form
        action={formAction}
        className="w-full max-w-xs rounded border border-accent-dim bg-black p-5"
      >
        <h1 className="mb-4 font-mono text-sm uppercase tracking-wide text-accent-bright">
          EpiCentre
        </h1>
        <PasswordInput
          name="password"
          autoFocus
          placeholder="Password"
          className="mb-3 rounded border border-accent-dim bg-black px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        {state.error && (
          <p className="mb-3 font-mono text-xs text-accent-bright">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-accent px-3 py-2 font-mono text-xs font-medium text-black hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
