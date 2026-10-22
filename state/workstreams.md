# Workstreams

Long-running, multi-part. The value is in **which parts remain**, not percent
complete.

---

## WS-5 — EpiCentre
**Status:** Phase A — design done (session 1, 2026-09-06), build not started ·
**Type:** Personal infrastructure

Single-user PWA. One place for everything outside work. Self-hosted on a
Hostinger VPS, reached over Tailscale (D-15). Long-run endgoal: a self-built
agent host on the same VPS (D-16).

| phase | description | status |
|---|---|---|
| 0 | Markdown state store + Python scripts | **done, superseded** |
| A | Shell + ledger module, deployed to the VPS, installed on phone | **current — building** |
| B | Second module — tests the module contract | not started |
| gate | One month of use, no new modules | not started |
| C | Expand, one module at a time | not started |
| later | Agents on the VPS (D-16) — not a phase yet, not scheduled | design-reserved only |

Exit conditions in `ROADMAP.md`.

**Phase 0 was not wasted.** It cost one session, forced the schema decisions
that `ARCHITECTURE.md` now depends on, and shipped a working calendar export
that survives as the reference implementation.

---

## Candidate modules

Named, not scheduled. None enter before Phase B, and only one at a time.

| domain | shape | notes |
|---|---|---|
| Ledger | dates + recurrence | **Phase A** |
| Meal prep | plans + recipes + shopping | Probably the simplest second module |
| Thai | practice log + vocabulary | Practice, not project — needs streak mechanics |
| Electric guitar | practice log + repertoire | Same shape as Thai; build one, learn the pattern |
| 3D printing | print queue + filament + settings | Most schema work of the four |

**Deliberately not listed: anything trading-related.** See D-08.

---

## Constraint

3–6 h/week, total, for everything. At that budget Phase A alone is 8–10 weeks.
Any plan implying more is wrong and should be scaled down, not hoped through.
