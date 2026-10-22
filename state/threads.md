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

## T-03 — Phase A: design done, build not started
**Status:** open · **Next action:** build step 0 — `git init` (done),
`state/` layout, `.nvmrc`, then step 1 (`create-next-app`)

Session 1 (2026-09-06) is complete. Outcomes:

- Module contract restated and confirmed.
- `ARCHITECTURE.md` critique done — problems P1–P10. All folded into the specs.
- **VPS adopted** (D-15): Hostinger KVM 2, reached over Tailscale, prod as a
  `systemd` service. Dev stays on localhost.
- **Agent integration** made a standing constraint (D-16); Phase A builds no
  agent code, only avoids foreclosing it via three cheap habits (mutation
  core + adapter, idempotent keys, one `getPrincipal()`).
- Forks resolved: drop `lib/schema.ts` for a drizzle glob (D-17); build the
  ledger flat then refactor into `modules/` at build step 10; keep all six
  agent accommodations (A1–A6).
- `git init` done (branch `main`), baseline + LF-normalization commits.

**Build order** (smallest shippable first): 0 git/layout · 1 create-next-app
on laptop · 2 provision VPS + deploy bare app + PWA manifest + install on
phone · 3 auth gate · 4 SQLite+Drizzle, one table · 5 add+list · 6
edit+delete · 7 seed from `state/ledger.md` · 8 nightly backup cron · 9
`lib/ics.ts` + `.ics` export → Google Calendar · 10 refactor into
`modules/ledger/` + registry + dashboard + extract `_template` · 11 deploy
script + `DEPLOY.md`.

**Not yet done:** the `state/` directory move. The five human-maintained
markdown files (`decisions.md`, `preferences.md`, `threads.md`,
`workstreams.md`, `ledger.md`) still sit at repo root; specs and
`build_ics.py --ledger` default assume `state/`. Do this at build step 0.

---

## T-04 — VPS baseline
**Status:** open · **Blocks:** build step 2 (first deploy)

Box confirmed: KVM, Ubuntu 24.04.4, root, systemd, 2 vCPU / 8 GB / 96 GB.

**Done:** identified and (pending Lucas running the paste) removed the
Hostinger "openclaw" one-click stack (openclaw + Traefik containers that held
80/443). Docker itself stays for future agent workers.

**Next steps, in order:** run the openclaw-removal paste → reboot (pending
kernel update) → `apt update && apt upgrade` → install Node (NodeSource LTS) +
`build-essential` → create a non-root deploy user → `ufw` allow SSH, enable →
install Tailscale on VPS + phone (+ laptop), `tailscale up`, enable MagicDNS +
HTTPS certs in the admin console.

---

## Retired

- **Greeks/vol reference matrix (delta by moneyness × time to expiry)** —
  desk-side study, tracked separately. Out of scope here per D-08.
