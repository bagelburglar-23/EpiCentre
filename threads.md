# Open Threads

Named resumption points with enough state to restart cold. This is the object
a task list can't represent.

**Rule:** before any session ends, write or update the relevant thread here.

---

## T-01 — Desk location confirmation
**Status:** open · **Blocks:** ledger admin entries only

Work export says Hong Kong desk (high confidence). Connection metadata reads
Singapore. Determines HKID vs NRIC, which public holiday set applies, and
whether COE/road tax entries belong in the ledger at all.

**Does not block the build** — both are UTC+8 with no DST, so the 16:00 alert
time and the VTIMEZONE block are correct either way.

---

## T-02 — Real ledger data not yet entered
**Status:** open · **Blocks:** Phase A exit condition

`state/ledger.md` still contains four `EXAMPLE` entries. Phase A cannot exit
until real dates are in.

**Next step:** dump birthdays, anniversaries, renewals, and expiries into the
`## Entries` section, unformatted. Run `python3 bin/build_ics.py`; the gaps
report names anything unparseable with a line number.

Roughly 20–40 entries is normal. Partial dates are fine (`????-MM-DD`).

---

## T-03 — Phase A not started
**Status:** open · **Next action:** paste `KICKOFF.md` into Claude Code

Nothing is scaffolded. The repo is currently specification only.

**First session should not produce code.** Per the kickoff prompt, it should
produce: a restatement of the module contract, a critique of
`ARCHITECTURE.md`, and a proposed build order. Design problems are cheaper to
fix now than at module three.

---

## Retired

- **Greeks/vol reference matrix (delta by moneyness × time to expiry)** —
  desk-side study, tracked separately. Out of scope here per D-08.
