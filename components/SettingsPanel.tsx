"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changePasswordAction } from "@/app/settings/actions";
import PasswordInput from "@/components/PasswordInput";
import SideRail from "@/components/SideRail";
import { getPref, setPref, applyTextSize, TEXT_SIZES } from "@/lib/prefs";
import { navigateTo } from "@/lib/nav-bus";

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "episplit", label: "EpiSplit" },
  { id: "reminders", label: "Reminders" },
  { id: "about", label: "About" },
] as const;

const inputCls =
  "rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-foreground/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function AccountSection() {
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
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex max-w-xs flex-col gap-2.5 rounded border border-accent-dim bg-black p-4"
      >
        <h2 className="mb-1 font-mono text-xs uppercase tracking-wide text-foreground/60">
          Change password
        </h2>
        <PasswordInput name="current" placeholder="Current password" required className={inputCls} />
        <PasswordInput name="next" placeholder="New password (min 8 characters)" required minLength={8} className={inputCls} />
        <PasswordInput name="confirm" placeholder="Confirm new password" required minLength={8} className={inputCls} />
        {state.error && <p className="font-mono text-xs text-accent-bright">{state.error}</p>}
        {state.success && (
          <p className="font-mono text-xs text-foreground/60">
            Password changed. Applies immediately — you won’t be logged out on
            this device; other devices need the new password next login.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded bg-accent px-3 py-1.5 font-mono text-xs font-medium text-black hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Changing…" : "Change password"}
        </button>
      </form>
      <p className="mt-3 max-w-xs font-mono text-[10px] text-foreground/40">
        One password, shared by prod and UAT. Changing it works from any
        logged-in device — no SSH needed.
      </p>
    </>
  );
}

export default function SettingsPanel() {
  const [section, setSection] = useState<string>("account");
  const [textSize, setTextSize] = useState("normal");
  const [defaultTax, setDefaultTax] = useState("20");

  /* eslint-disable react-hooks/set-state-in-effect -- load per-device prefs
     after mount so server and client markup match (no hydration mismatch). */
  useEffect(() => {
    setTextSize(getPref("textSize", "normal"));
    setDefaultTax(getPref("episplit.defaultTax", "20"));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function chooseTextSize(v: string) {
    setTextSize(v);
    setPref("textSize", v);
    applyTextSize(v);
  }
  function changeTax(v: string) {
    setDefaultTax(v);
    setPref("episplit.defaultTax", v);
  }

  return (
    <div className="flex h-full">
      <SideRail title="Settings" helpSection="guide-settings">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded px-2 py-1 text-left text-sm ${
              section === s.id
                ? "bg-accent-dim text-accent-bright"
                : "text-foreground/70 hover:bg-accent-dim/40 hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </SideRail>

      <div className="flex-1 overflow-auto p-4">
        <h1 className="mb-4 font-mono text-sm uppercase tracking-wide text-accent-bright">
          {SECTIONS.find((s) => s.id === section)?.label}
        </h1>

        {section === "account" && <AccountSection />}

        {section === "appearance" && (
          <div className="flex max-w-xs flex-col gap-3">
            <Field label="Text size">
              <div className="flex gap-1">
                {Object.keys(TEXT_SIZES).map((k) => (
                  <button
                    key={k}
                    onClick={() => chooseTextSize(k)}
                    className={`flex-1 rounded border px-2 py-1.5 font-mono text-xs capitalize ${
                      textSize === k
                        ? "border-accent bg-accent-dim text-accent-bright"
                        : "border-accent-dim text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Field>
            <p className="font-mono text-[10px] text-foreground/40">
              Scales most of the interface. Per-device (stored on this device
              only). The theme itself is fixed (accent shows the environment:
              red = prod, blue/grey = UAT).
            </p>
          </div>
        )}

        {section === "episplit" && (
          <div className="flex max-w-xs flex-col gap-3">
            <Field label="Default tax %">
              <input
                inputMode="decimal"
                value={defaultTax}
                onChange={(e) => changeTax(e.target.value)}
                placeholder="20"
                className={`${inputCls} w-24`}
              />
            </Field>
            <p className="font-mono text-[10px] text-foreground/40">
              New EpiSplit items and scanned receipts start at this rate (you
              can still override per item). Per-device.
            </p>
          </div>
        )}

        {section === "reminders" && (
          <div className="flex max-w-md flex-col gap-2 text-sm text-foreground/75">
            <p>
              Telegram sends a digest of your open to-dos, grouped by list —
              one message per list — <strong>three times a day</strong>:
            </p>
            <ul className="ml-4 list-disc font-mono text-xs">
              <li>08:30 HKT — morning</li>
              <li>16:00 HKT — afternoon (the window you actually see alerts)</li>
              <li>22:00 HKT — night wind-down</li>
            </ul>
            <p className="font-mono text-[10px] text-foreground/40">
              Times are server-side (systemd timer on the VPS), not a per-device
              setting. Google Calendar remains the authoritative alert channel
              (D-12); Telegram is the reliable nudge.
            </p>
          </div>
        )}

        {section === "about" && (
          <div className="flex max-w-md flex-col gap-2 text-sm text-foreground/75">
            <p>
              EpiCentre — your personal, self-hosted hub. Single user, running
              on a VPS reached only over your Tailscale tailnet.
            </p>
            <p>
              How it’s built, module by module, and every change since PR #1
              lives in <strong>EpiDev</strong>.
            </p>
            <button
              onClick={() => navigateTo("developer")}
              className="w-fit rounded border border-accent-dim px-3 py-1.5 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright"
            >
              Open EpiDev →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
