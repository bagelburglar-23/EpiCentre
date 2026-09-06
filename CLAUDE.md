# EpiCentre — agent instructions

Single-user personal app. Next.js + TypeScript + SQLite + Drizzle, delivered
as an installable PWA. Self-hosted on a Hostinger VPS, reached only over a
Tailscale tailnet (D-15). The long-run endgoal is EpiCentre as a self-built
agent host on that same VPS (D-16) — Phase A only keeps that door open, it
builds no agent code.

Read `ARCHITECTURE.md` before writing code — the module contract there is not
a style preference, it is the thing that makes this project viable.
`ROADMAP.md` defines what is in scope right now.

---

## Who you're working with

Lucas is an equity derivatives trader — strong quantitative and scripting
background (Python, PowerShell, heavy Excel), **but new to TypeScript, React,
and web development entirely.** This is his first web app.

That combination means:

- **Don't over-explain programming.** Loops, state, data modelling, debugging
  — all familiar. Explaining them wastes the turn.
- **Do explain web-specific mechanics** the first time they appear: the
  server/client boundary, hydration, why `"use server"` exists, what a
  service worker does. These have no analogue in his background.
- **Name the idiom.** When you use a React or Next.js pattern, say what it's
  called so it's searchable later.
- **Never leave generated code unexplained.** If he can't modify it alone, it
  is a liability. He must be able to ship features without you.

---

## Hard constraints

| id | rule |
|---|---|
| **D-08** | **No desk content, ever.** No positions, client names, risk figures, P&L, internal hostnames, network paths, or add-in filenames. Lucas works at a bank with records and surveillance obligations; this app is off-system. |
| **D-10** | **No module imports another module.** Not types, not helpers, not constants. Shared code lives in `lib/`. |
| **D-11** | Single-user. **No user table, no roles, no permissions, no multi-tenancy.** One password, one cookie. Agent bearer tokens (later) are config, not users. |
| **D-12** | The app does **not** own alerting. It exports `.ics`; Google Calendar fires alerts. |
| **D-13** | Server actions, not API routes — **for the app's own front-end.** The one exception is the future agent handler (D-16): one generic registry-driven route, never one per module. |
| **D-15** | Prod runs on the Hostinger VPS as a `systemd` service, reachable only over Tailscale. Dev is `localhost`. Code moves dev→prod by git; data does not move. |
| **D-16** | Agents (future) run as **separate processes on the VPS** and reach EpiCentre only through an authenticated capability interface. Never import a module, never in-process, never touch the DB file directly. Build no agent code in Phase A — only avoid foreclosing it. |

**On D-08 specifically:** a trading-journal module is the obvious temptation
and the hard case. Reflections on his own learning and study material are
fine. Anything touching the book — positions, sizes, client flow, P&L — never
lands here. If he pastes something borderline, flag it *before* writing it to
a file or database.

Full list with rationale in `state/decisions.md`. These are settled — don't
re-litigate. To overturn one, supersede it with a new numbered entry rather
than editing the old one; the supersession history is deliberate.

---

## Working preferences

Full version: `state/preferences.md`.

- **Precision over narrative.** Tables and enumerations beat prose for
  anything reference-shaped.
- **Skip the direction, give the mechanism.** He usually knows *that*
  something is true; he wants *why*.
- **Expect adversarial probing.** He will find the weakest inference in an
  explanation and attack it. Volunteer your own uncertainty first — a hedge he
  finds himself costs more than one you flagged.
- **Exact naming.** Precise file paths, package names, versions, commands.
- **State conventions explicitly.** A framework that shifts underneath an
  argument invalidates it.

---

## Scope discipline

`ROADMAP.md` names the current phase and its exit condition.

> Is this in the current phase's exit condition?
> **Yes** → build it.
> **No** → append to `BACKLOG.md` with today's date. Do not open the editor.

**Push back on scope creep.** He asked for this explicitly. "While we're in
here, let's also…" during Phase A is the most likely way this project dies.
Say so plainly when it happens.

Do not add: tests, CI, dark mode, animations, charts, or an abstraction layer,
unless the current phase names them.

**Docker** is already installed on the VPS and stays — it is how the future
agent workers (D-16) will run. It is *not* used to package the EpiCentre app
in Phase A; the app runs as a plain `systemd` + Node service. Don't
containerize the app, and don't remove Docker.

---

## Non-obvious things

**`bin/build_ics.py` stays, and is not dead code.** It is the tested reference
implementation of the `.ics` export. When porting to TS, port its *logic* —
it already handles the parts that are easy to get wrong:

- line folding counts **octets, not characters** (RFC 5545) — matters
  immediately, since Chinese names are expected
- `UID` is a content hash, so re-importing updates events instead of
  duplicating them
- `DTSTAMP` is a fixed constant so output is byte-identical across builds
- 29 Feb anchors to 28 Feb and does not self-correct in leap years — a known
  limitation, logged, not a bug to fix mid-phase

**Alert times are 16:00 local, not morning.** Lucas trades Tokyo hours
(~07:00–15:30) then covers derivatives in the evening (~18:00 onward). The
gap between them is the only window an alert will actually be seen. Don't
"helpfully" move alerts to 9am.

**`state/*.md` is seed data and context, not application data.** The app reads
it once to seed SQLite. After that, SQLite is authoritative for the ledger.
`decisions.md`, `preferences.md`, `threads.md` remain the human-maintained
record and are not migrated.

**Migrations are generated by drizzle-kit and never hand-edited.** No
exceptions. `drizzle.config.ts` globs `modules/**/schema.ts` — there is no
central `lib/schema.ts` (D-17).

**The VPS was cleaned before Phase A.** It previously ran a Hostinger
one-click "openclaw" agent stack (openclaw + Traefik containers on 80/443).
Both were removed; Docker itself stays. If something on ports 80/443 or a
`hvps-*` container reappears, that is Hostinger re-provisioning — flag it.

**Agent-readiness is three cheap habits, not a feature.** (1) Every mutation
is a plain `core(input)` function plus a thin `"use server"` form adapter —
callers use the core. (2) Mutations are idempotent on a natural key. (3) Auth
is one `getPrincipal()` function. Do these by default in Phase A; they cost
almost nothing and mean the agent phase adds code without editing every
module. If any of them starts costing real time, stop and say so.

---

## Operating context

| window | local time | available |
|---|---|---|
| Tokyo equities | ~07:00–15:30 | no |
| Gap | ~15:30–18:00 | yes — alerts land here |
| Evening derivatives | ~18:00 onward | no |
| Weekends | — | yes — ~3–6 h/week total |

**3–6 h/week is the binding constraint on every proposal.** If a suggestion
implies more, say so and scale it down rather than quietly assuming he'll
find the time.

---

## End of session

Before a session ends, update `state/threads.md` with a resumption point
detailed enough to restart cold — he routinely leaves work mid-task and
returns weeks later. Include: what was in progress, what the next concrete
step is, and anything discovered that isn't yet written down.
