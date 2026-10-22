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

## T-03 — Phase A: build in progress (started 2026-10-22)
**Status:** open · **Next action:** finish the Next.js scaffold once Node
finishes installing on the laptop (blocked on a Windows admin-permission
prompt as of this session), then push to the VPS.

Session 1 (2026-09-06): design only, no code. Outcomes: module contract
confirmed; `ARCHITECTURE.md` critique (P1–P10) folded in; VPS adopted (D-15);
agent integration made a standing constraint (D-16); drop `lib/schema.ts` for
a drizzle glob (D-17); `git init` done.

Session 2 (2026-10-22): asked for the fastest path to "hub running 24/7,
installable on desktop Chrome + iPhone." Re-scoped the deploy mechanism for
speed — **no GitHub, no separate `deploy.sh`, no non-root push user.** A bare
repo on the VPS (`/opt/epicentre.git`) with a `post-receive` hook
(`deploy/post-receive`) builds and restarts on every `git push vps main`; the
VPS's own `deploy` account is a no-login system account that only *runs* the
service (`ARCHITECTURE.md` "Hosting & deploy" updated to match; the push
itself still runs as root — flagged as a known shortcut in `DEPLOY.md`, not
hardened yet). Progress this session:

- `state/` + `bin/` move done (resolves the path drift noted in session 1).
- `deploy/epicentre.service`, `deploy/post-receive`, `DEPLOY.md` written.
- Node.js LTS install kicked off via `winget` — **stalled on a Windows UAC
  prompt** that needs a manual click (the tool can't answer a GUI dialog).
  Check `node -v` on the laptop; if still missing, the winget install is
  sitting at an elevation prompt — click it, or run
  `winget install --id OpenJS.NodeJS.LTS -e` by hand.

**Once Node is confirmed:** scaffold Next.js in place (same approach as
before — set `.gitignore`/`.gitattributes`/`README.md` aside, run
`create-next-app@latest .`, restore them), add a minimal shell page + PWA
manifest, commit.

**Build order** (smallest shippable first, condensed for speed): 0 repo
layout (done) · 1 create-next-app + minimal shell + manifest (in progress) ·
2 VPS one-time setup (`DEPLOY.md`) + first `git push vps main` + `tailscale
serve --bg 3000` + install on phone/desktop · 3 auth gate · 4 SQLite+Drizzle ·
5 add+list · 6 edit+delete · 7 seed from `state/ledger.md` · 8 nightly backup
cron · 9 `.ics` export → Google Calendar · 10 refactor into `modules/ledger/`
+ registry + dashboard + extract `_template`.

**Not yet done, explicitly deferred past today's "live" milestone:** the
password gate (D-11/D-13 — box is tailnet-only and holds no data yet, so
this is acceptable for a few days but not longer), nightly backup cron (no
DB yet either).

---

## T-04 — VPS baseline
**Status:** mostly done · **Blocks:** nothing currently

Box confirmed: KVM, Ubuntu 24.04.4, root, systemd, 2 vCPU / 8 GB / 96 GB.
**openclaw + Traefik removed and verified** (2026-09-06 session) — ports
80/443 free, 1.4 GB reclaimed, Docker itself kept for future agent workers.

**Remaining, all in `DEPLOY.md`'s one consolidated script:** `apt upgrade` +
reboot (pending kernel update was still outstanding last check) → Node 22 +
`build-essential` → the `deploy` system account → the bare repo + hook →
the `systemd` unit → `ufw` → Tailscale install + `tailscale up` (needs a
browser approval click) → `tailscale serve --bg 3000` once something is
listening on port 3000.

---

## Retired

- **Greeks/vol reference matrix (delta by moneyness × time to expiry)** —
  desk-side study, tracked separately. Out of scope here per D-08.
