# Backlog

Wanted, not built. Add freely — nothing here gets built during the current
phase. See `ROADMAP.md`.

**Format:** `- [YYYY-MM-DD] description` — date it, so you can see how long it
survived. Items that sit for a month and still feel necessary are the only
ones worth building. Most die here. That is the point.

## Deferred from Phase A

- [2026-09-03] Dark mode / theming
- [2026-09-03] Charts and dashboards
- [2026-09-03] Tests + CI (CI = auto-deploy on git push; Phase A deploy is a manual script)
- [2026-09-03] Containerize the EpiCentre app (Docker is on the VPS already, but for agent workers, not the app)
- [2026-09-03] Offline writes with conflict resolution
- [2026-09-03] Multi-device sync (a second writer; reads over the tailnet already work)
- [2026-09-03] Full-text search across modules
- [2026-09-06] Litestream — continuous SQLite replication to object storage (nightly `.backup` cron covers Phase A)
- [2026-09-06] Tailnet-only SSH — drop public SSH once Tailscale is stable
- [2026-09-06] Public Tailscale Funnel or claim the free domain, if the app ever needs to be reachable off-tailnet

## Promoted out of backlog

- [2026-09-03 → 2026-09-06] Hosting on a VPS — **decided, D-15.** Hostinger KVM 2,
  Tailscale ingress, from Phase A. D-08 now operative for the box.

## Agent integration — design-reserved (not before Phase B)

The surface is kept open in Phase A (D-16); none of this is built until the
agent phase, and the semantics are still open (`decisions.md` "Open").

- [2026-09-06] Generic agent route — `app/api/agent/[...]/route.ts`, token auth, registry lookup
- [2026-09-06] `AGENT_TOKENS` env var + `getPrincipal()` token branch
- [2026-09-06] `agentCapabilities` slot on each module's `capabilities.ts`
- [2026-09-06] Task / pending-change model — depends on the approval-flow decision
- [2026-09-06] `source` column (`user` | `agent:<id>`) on module tables — clean nullable migration
- [2026-09-06] Agent worker processes — Docker Compose on the VPS (app + workers + reverse proxy)

## Candidate modules

Not before Phase B, one at a time.

- [2026-09-03] Meal prep — plans, recipes, shopping list
- [2026-09-03] Thai — practice log, vocabulary, streak
- [2026-09-03] Electric guitar — practice log, repertoire, streak
- [2026-09-03] 3D printing — print queue, filament inventory, settings

## Ledger refinements

- [2026-09-03] Lunar-calendar birthdays (CNY-relative dates don't fit YYYY-MM-DD)
- [2026-09-03] 29 Feb anchors permanently to 28 Feb; won't self-correct in leap years
- [2026-09-03] Public holiday import once T-01 resolves
- [2026-09-03] Gift history per person — what was given, when

## New

<!-- add below -->
