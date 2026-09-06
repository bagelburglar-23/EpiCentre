# Roadmap

Replaces `FREEZE.md`. A freeze was the right discipline for finished code and
the wrong one for an active build — but the *reason* for it survives: an
unbounded build at 3–6 h/week never ships.

The discipline is now **phase gates**. One phase at a time, each with an exit
condition you can't argue with.

## Phase A — Shell + Ledger

**Exit condition: the ledger works on your phone, installed to the home
screen, with your real dates in it.**

- Next.js + TS + Tailwind + shadcn/ui scaffold
- SQLite + Drizzle, migrations working
- Password gate
- Shell: nav, dashboard, module registry
- `modules/ledger`: CRUD, list, `.ics` export
- Seed from `state/ledger.md`
- PWA manifest + service worker

Not in Phase A: any second module, offline writes, hosting, theming, charts.

**Estimated 30–40 h. At 4 h/week that is 8–10 weeks.** Most of it is the
learning curve, not the code. Expect the first two weekends to feel slow.

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
