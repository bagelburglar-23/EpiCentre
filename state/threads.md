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

## T-03 — Phase A exit condition: met (2026-10-25)

Ledger... well, superseded by events (see T-05) — the actual Phase A
deliverable (installable, VPS-hosted, on PC + Phone) shipped 2026-10-25.
Real ledger data entry (T-02) is still open but no longer blocking — the
app evolved past a ledger-only scope that evening (see T-05). Kept here for
history; **T-05 is the live thread now.**

---

## T-04 — VPS baseline: done
**Status:** done · **Blocks:** nothing

KVM, Ubuntu 24.04.4, 2 vCPU/8GB/96GB. `claude` is an unprivileged, no-sudo
user (deliberately — see `ARCHITECTURE.md` "Agent integration" and the
plan file history: a first attempt to grant Claude sudo was refused by
Claude Code's own safety classifier). Runs the app via `systemctl --user`
with `loginctl enable-linger claude`. Tailscale operator rights granted to
`claude` (`tailscale set --operator=claude`) so Claude can manage serve
rules without root. Node 24, build-essential, all present.

---

## T-05 — Review-gated pipeline + first real features (live thread)
**Status:** open, mid-build · **Started:** 2026-10-25, continuing into
2026-10-26 as an unattended overnight batch while Lucas slept.

### The pipeline (shipped, working)

Branch → push (human, Claude is blocked from `git push` by Claude Code's
own publish-safety classifier — hit repeatedly, not worth fighting) →
GitHub Action auto-opens a PR + deploys to a **UAT instance** on the VPS →
review the diff + click around the live UAT URL → merge → a second Action
deploys to **prod**. Both environments share one SQLite database
(`/home/claude/shared/epicentre.db`) — not synced copies, genuinely the
same file (WAL mode) — with an `is_test` column convention so UAT-only test
rows never reach prod's queries. UAT's accent color (red/blue/grey Tron
theme) reflects whether its deployed commit matches prod's, read live via
a `deploy_state` table, not baked in at build time.

**URLs:** prod `https://srv1648855.tail523e0b.ts.net/` · UAT
`https://srv1648855.tail523e0b.ts.net:8443/` (a dedicated port, not a path
— `tailscale serve --set-path` turned out to strip the prefix before
forwarding, which breaks Next.js's asset URLs under a `basePath`; a
separate HTTPS port sidesteps the whole problem. Do not reintroduce a
path-mounted UAT without re-reading that fight in the git log first.)

**Two installable PWAs**, confirmed working on PC + Phone: "EpiCentre"
(red ripple-rings icon) and "EpiCentre UAT" (blue) — different origins
(different port = different origin) means they install as genuinely
separate apps.

### Branches in flight, not yet pushed/merged

- `feature/todo-list-and-shell` — **committed locally, not yet pushed.**
  Sidebar + VS Code-style tabs (now localStorage-persistent across
  refresh), a real `todos` table (title/details/due_date/reminder_sent,
  additive columns only — this table is on the shared DB, a destructive
  change would break prod and UAT simultaneously), popup entry modal,
  Telegram reminder script (`scripts/send-due-reminders.mjs`, standalone,
  no `next/server` import so it runs via plain `node`) wired to a daily
  VPS systemd timer (09:00 UTC) that currently no-ops — safe — until
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` exist in
  `/home/claude/epicentre.env`. Site-wide Inter+JetBrains Mono, tighter
  spacing ("sleek compact electronic" ask).
  **Resume:** `git push origin feature/todo-list-and-shell`, then open the
  PR, review on UAT, merge.

- `feature/calplus-base` — **committed locally, not yet pushed. Branched on
  top of `feature/todo-list-and-shell`** (needs its Shell component) — push
  and merge that one first, or GitHub will show a combined diff, which is
  fine but worth knowing going in. New `events` table (same shared-DB/
  `is_test` pattern), month-grid Cal+ panel, event CRUD. **Not visually
  verified** — curl can't click the sidebar tab to render the calendar
  grid client-side; the build is clean and the data layer is tested, but
  actually look at the month grid before trusting it fully.
  Google Calendar sync is **not implemented** — `lib/google-calendar.ts`
  is a scaffold, `GCAL_SETUP.md` (repo root) has the exact steps to get
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. v1 plan is one-way (EpiC→
  Google push) only — two-way needs a conflict-resolution design not worth
  rushing blind.
  **Resume:** `git push origin feature/calplus-base`, same review flow.

### Waiting on Lucas (nothing to build until these arrive)

- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (via @BotFather — see the
  session where this was asked) → add to `/home/claude/epicentre.env`,
  reminders start working on the next scheduled timer run, no redeploy
  needed.
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (steps in `GCAL_SETUP.md`) →
  unblocks building the actual GCal OAuth + one-way sync.

### Update, later the same night — both branches merged, 3 more built

Both branches above got merged (`todo-list-and-shell`, `calplus-base`) —
confirmed live on prod. Three more branches since, **committed locally,
not yet pushed:**

- `feature/sync-uat-on-merge` — real bug found live: a merge always
  creates a new commit SHA distinct from the feature branch tip, so UAT's
  accent could never turn grey post-merge under the original design
  (fixed it before realizing — manually synced UAT once to confirm the
  fix works; the commit is what makes it automatic going forward). Push,
  review, merge like the others.
- `feature/auth-gate` — password gate, `lib/auth.ts` + `proxy.ts` (Next.js
  16 renamed `middleware.ts` → `proxy.ts` mid-session — fixed to avoid
  shipping with a deprecation warning). `SESSION_SECRET`/`APP_PASSWORD`
  already generated and set in both VPS env files — **not derivable from
  the diff**, check `/home/claude/epicentre.env` directly if the password
  needs retrieving/changing later. **Verified:** clean build, unauthenticated
  requests correctly redirect to `/login`. **Not verified:** the actual
  login form submission — goes through React's own server-action fetch
  protocol, which curl can't replicate (confirmed by inspecting the
  rendered form's deliberately inert `action="javascript:throw..."`
  attribute). Needs a real browser check before trusting it fully.

Push order: `sync-uat-on-merge` and `auth-gate` are independent of each
other, either order is fine; both are already based on current `main`.

### Known not-yet-done, not blocking anything above

- Password gate (D-11/D-13) — still open. Box is tailnet-only, but real
  data (todos, events) now exists where it didn't before. This is the
  next thing to prioritize once the two branches above are merged and
  settled, not indefinitely deferred.
- `state/ledger.md` real entries (T-02) — the original ledger module
  itself hasn't been built yet; the to-do list became the first real
  module instead (Lucas's call, documented in conversation).
- Nightly SQLite backup cron (ARCHITECTURE.md's original plan) — more
  pressing now that real todos/events data exists in the shared DB.

---

## Retired

- **Greeks/vol reference matrix (delta by moneyness × time to expiry)** —
  desk-side study, tracked separately. Out of scope here per D-08.
