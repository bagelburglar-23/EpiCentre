# Roadmap

Replaces `FREEZE.md`. A freeze was the right discipline for finished code and
the wrong one for an active build — but the *reason* for it survives: an
unbounded build at 3–6 h/week never ships.

The discipline is now **phase gates**. One phase at a time, each with an exit
condition you can't argue with.

## Phase A — Shell + Ledger

**Exit condition: the ledger works on your phone, installed to the home
screen, served from the VPS, with your real dates in it.**

- Next.js + TS + Tailwind + shadcn/ui scaffold
- VPS baseline: Node (NodeSource), `build-essential`, non-root deploy user,
  `ufw`, kernel update + reboot
- Deployed to the VPS as a `systemd` service, reachable over Tailscale with a
  real HTTPS cert (D-15)
- Password gate (`jose` cookie, `getPrincipal()`) — **before** the box holds
  real data, not last
- SQLite + Drizzle, migrations working (glob schema, D-17)
- Nightly `sqlite3 .backup` cron on the VPS
- Shell: nav, dashboard, module registry
- `modules/ledger`: CRUD, list, `.ics` export (via `lib/ics.ts`)
- Seed from `state/ledger.md` (reuses the mutation core)
- PWA manifest + minimal service worker

Not in Phase A: any second module, offline writes, theming, charts, **any
agent code** (the *design* accommodates agents per D-16; no agent is built).

**Estimated 40–50 h. At 4 h/week that is ~11–13 weeks.** The VPS adds ~6–10 h
of mostly one-time infrastructure. Most of the rest is the learning curve, not
the code. Expect the first two weekends to feel slow.

## Phase B — Second module

**Exit condition: a second module shipped, and you have measured how long it
took.**

Purpose is not the module. It is **testing rule 3 of the module contract.**

- Under 8 h → the abstraction holds. Proceed.
- Over 20 h → the shell is wrong. **Fix the shell now**, with two real
  examples in hand. Do not add a third module first.

Pick the simplest domain you actually want, not the most interesting one.

## Gate — use it for a month

**No new modules for four weeks.** Live with two. This is where you find out
what the app is actually missing, as opposed to what seemed appealing while
building.

Everything you think of during this month goes to `BACKLOG.md`, dated. Most
items die here, which is the point.

## Phase C — expand

One module at a time. Any backlog item that survived the month is a candidate.

**WIP cap: one module in progress at a time.** Not two.

## Later — Agents (D-16)

The endgoal: EpiCentre as a self-built agent host running on the same VPS.
Not a phase yet, and deliberately not scheduled — it does not begin until at
least two modules exist and the module contract has been tested (Phase B).
The Phase A build only guarantees the *integration surface* is not foreclosed:
a mutation core agents can call, a manifest slot for `agentCapabilities`, an
auth function that grows a token branch, Docker left installed. Everything
else — the agent route, tokens, task model, workers — is in `BACKLOG.md` and
the semantics are in `decisions.md` "Open".

## Scope discipline during a phase

The freeze's core test still applies, narrowed to the phase:

> Is this in the current phase's exit condition?
> **Yes** → build it.
> **No** → `BACKLOG.md`, dated. Do not open the editor.

Scope creep inside Phase A is the single most likely way this dies. "While I'm
in here I'll add dark mode" is how 30 hours becomes 80.

## Maintenance ceiling

Unchanged from the freeze, and still the kill condition: **if EpiCentre costs
more than 1 hour of maintenance in a month**, it is eating the time it exists
to free. Cut scope or kill it.

Maintenance means keeping it running. Building new features is not
maintenance.
