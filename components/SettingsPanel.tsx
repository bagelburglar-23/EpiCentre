"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  changePasswordAction,
  addReminderSlotAction,
  updateReminderSlotAction,
  deleteReminderSlotAction,
} from "@/app/settings/actions";
import type { ReminderSlot } from "@/lib/reminders";
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

// Editable control board for the Telegram reminder times. The server owns the
// schedule (reminder_slots table); each row edits one slot. Actions revalidate
// "/", so after any mutation the page re-renders and hands this component a
// fresh `slots` prop - adopted via the render-time reconcile below so an
// optimistic local edit is replaced by the authoritative server state.
function RemindersSection({ slots }: { slots: ReminderSlot[] }) {
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<ReminderSlot[]>(slots);
  const [prevSlots, setPrevSlots] = useState<ReminderSlot[]>(slots);

  // Reconcile new server data into local state during render (the canonical
  // "store previous props" pattern - not an effect, so no extra paint).
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    setRows(slots);
  }

  function setTimeLocal(id: number, time: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, time } : r)));
  }
  function commitTime(id: number, time: string, enabled: boolean) {
    if (!/^\d{2}:\d{2}$/.test(time)) return; // native picker was cleared
    startTransition(() => updateReminderSlotAction(id, time, enabled));
  }
  function toggle(id: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const enabled = !row.enabled;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, enabled } : r)));
    startTransition(() => updateReminderSlotAction(id, row.time, enabled));
  }
  function remove(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => deleteReminderSlotAction(id));
  }
  function add() {
    startTransition(() => addReminderSlotAction("09:00"));
  }

  return (
    <div className="flex max-w-md flex-col gap-3 text-sm text-foreground/75">
      <p>
        Telegram sends a digest of your open to-dos, grouped by list — one
        message per list — at each time below. Add, remove, or retime slots;
        changes take effect on the next send.
      </p>

      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="font-mono text-[11px] text-foreground/40">
            No reminder times — the digest never sends. Add one below.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded border border-accent-dim bg-black px-3 py-2"
          >
            <input
              type="time"
              value={r.time}
              onChange={(e) => setTimeLocal(r.id, e.target.value)}
              onBlur={(e) => commitTime(r.id, e.target.value, r.enabled)}
              className={`${inputCls} w-28 ${r.enabled ? "" : "opacity-40"}`}
            />
            <span className="font-mono text-[10px] uppercase tracking-wide text-foreground/40">
              HKT
            </span>
            <button
              onClick={() => toggle(r.id)}
              className={`ml-auto rounded border px-2 py-1 font-mono text-[11px] ${
                r.enabled
                  ? "border-accent bg-accent-dim text-accent-bright"
                  : "border-accent-dim text-foreground/40 hover:text-foreground"
              }`}
            >
              {r.enabled ? "On" : "Off"}
            </button>
            <button
              onClick={() => remove(r.id)}
              aria-label="Delete reminder time"
              className="rounded border border-accent-dim px-2 py-1 font-mono text-[11px] text-foreground/50 hover:border-accent-bright hover:text-accent-bright"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="w-fit rounded border border-accent-dim px-3 py-1.5 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright"
      >
        + Add reminder time
      </button>

      <p className="font-mono text-[10px] text-foreground/40">
        Times are HKT and server-side (shared by all your devices, not
        per-device). The VPS checks every 5 minutes and fires any slot that has
        come due, once per day. Google Calendar remains the authoritative alert
        channel (D-12); Telegram is the reliable nudge.
      </p>
    </div>
  );
}

export default function SettingsPanel({
  reminderSlots,
}: {
  reminderSlots: ReminderSlot[];
}) {
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

        {section === "reminders" && <RemindersSection slots={reminderSlots} />}

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
