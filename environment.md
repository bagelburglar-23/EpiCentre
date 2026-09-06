# Environment

## Stack

| component | detail |
|---|---|
| Runtime | Node.js — LTS. Required by Next.js. |
| Framework | Next.js, App Router |
| Language | TypeScript |
| DB | SQLite via `better-sqlite3` |
| ORM | Drizzle + drizzle-kit for migrations |
| Styling | Tailwind |
| Components | shadcn/ui — copied into the repo, not a dependency |
| Delivery | PWA, installable to home screen |
| Editor | VS Code + Claude Code extension |

## Legacy — still works

| component | detail |
|---|---|
| `bin/build_ics.py` | Python 3.8+, **standard library only**. No venv, no install. Runs anywhere. |

## Scope note

Desk infrastructure — internal hostnames, network paths, add-in filenames and
versions — is deliberately **excluded** per D-08. That information lives on
desk-side systems only and must never be committed here.

## Operating windows

| window | local time | available |
|---|---|---|
| Tokyo equities block | ~07:00–15:30 | no |
| Gap | ~15:30–18:00 | **yes — ledger alerts land here** |
| Evening derivatives block | ~18:00 onward | no |
| Weekends | — | yes — build time, ~3–6 h/week total |

Desk location Hong Kong per work export, unconfirmed (T-01). Both HK and SG
are UTC+8 with no DST, so `Asia/Hong_Kong` in the VTIMEZONE block is correct
either way.
