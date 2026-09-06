# EpiCentre

Single-user personal app. One place for everything outside work.

**Status: Phase A — shell + ledger.** See `ROADMAP.md`.

## Documents

| file | what it's for |
|---|---|
| `ARCHITECTURE.md` | Stack, module contract, the rules that keep features cheap |
| `ROADMAP.md` | Current phase and its exit condition |
| `CLAUDE.md` | Agent instructions — loads automatically in Claude Code |
| `KICKOFF.md` | Prompt to start the first Claude Code session |
| `BACKLOG.md` | Wanted, not built. Dated. |
| `state/` | Decisions, preferences, open threads, seed data |

## Read in this order

1. `ARCHITECTURE.md` — the module contract is the whole design
2. `ROADMAP.md` — what's in scope now
3. `state/decisions.md` — settled constraints and why

## Stack

Next.js (App Router) · TypeScript · SQLite + Drizzle · Tailwind · shadcn/ui ·
installable PWA.

Nothing is scaffolded yet. `KICKOFF.md` starts that.

## What survives from Phase 1

The previous version was a markdown state store with Python scripts. It cost
one session, forced the schema decisions, and shipped a working calendar. It
has done its job.

| kept | superseded |
|---|---|
| `state/*.md` — seed data and context | `bin/context.py` — the app is the context |
| `bin/build_ics.py` — reference implementation for `.ics` export | `FREEZE.md` → `ROADMAP.md` |
| `decisions.md` history, including superseded entries | `CURRICULUM.md` — learning now happens by building |

`bin/build_ics.py` still runs standalone and needs nothing but Python 3.8+.
Use it until the app's export replaces it.

```
python3 bin/build_ics.py
```

## Non-negotiables

- **D-08** — no desk content in this repo or database, ever
- **D-10** — no module imports another module
- **D-12** — Google Calendar owns alerting; the app only exports `.ics`
- Migrations are generated, never hand-edited
