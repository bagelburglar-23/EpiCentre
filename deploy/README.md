# VPS deployment — as actually running (2026-11-01)

Supersedes `DEPLOY.md`.

| item | value |
|---|---|
| Host | Hostinger KVM 2, Ubuntu 24.04. Tailnet name `srv1648855` (`100.65.233.34`). **Don't rename the machine in Tailscale** — the machine name *is* the app's hostname. |
| Runtime user | `claude` (uid 1001, no sudo). Every service is a systemd **user** unit; `loginctl enable-linger claude` keeps them running with nobody logged in. |
| Prod | checkout `~/epicentre` · `epicentre.service` · port 3000 · `https://srv1648855.tail523e0b.ts.net/` |
| UAT | checkout `~/epicentre-preview` · `epicentre-preview.service` · port 3001 · `https://srv1648855.tail523e0b.ts.net:8443/` |
| Database | `~/shared/epicentre.db` — **one file shared by prod and UAT** (WAL). `is_test = 1` rows are hidden from prod. Schema changes must be additive. |
| Secrets | `~/epicentre.env`, `~/epicentre-preview.env` (chmod 600, never in git) |
| Timers | `sync-google-events.timer` every 30 min · `send-reminders.timer` daily 09:00 **UTC** (= 17:00 HKT) |
| Claude | `claude-rc.service` — Remote Control server in `~/work/EpiCentre`, one git worktree per session |
| Ingress | `tailscale serve`: `/` → 3000, `:8443` → 3001 (persistent, set with `--bg`) |

**Env var names** (values exist only on the VPS):
prod — `DEPLOY_ENV DATABASE_PATH SESSION_SECRET APP_PASSWORD TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET`;
UAT — the same minus the two `TELEGRAM_*`.

## Deploys

GitHub Actions only (`.github/workflows/`), over SSH as `claude`:

- push `feature/**` or `claude/**` → PR auto-opens + UAT rebuilds (accent blue)
- merge to `main` → prod rebuilds, then UAT is reset to `main` (accent grey)

Both jobs run `git reset --hard` in `~/epicentre` / `~/epicentre-preview`.
**Never edit files in those checkouts** — work in `~/work/EpiCentre`.
`main` is protected by the `protect-main` ruleset (PR required, no force
push, no deletion, no bypass) — the VPS deploy key has write access, so
the ruleset is what keeps pushes off `main`.

## Unit files

`systemd-user/` holds copies; the live files are in
`~/.config/systemd/user/`. After changing a live unit:
`systemctl --user daemon-reload && systemctl --user restart <unit>`, then
copy it back here.

## Commands

```bash
systemctl --user status epicentre epicentre-preview claude-rc
journalctl --user -u epicentre -n 100 --no-pager
journalctl --user -u claude-rc -n 50 --no-pager
systemctl --user list-timers
tailscale serve status
```

## Access

`ssh claude@100.65.233.34` — key auth only (laptop alias: `ssh epic`).
Root has a password (reset in hPanel) and is rarely needed. Fallback with
no keys at all: hPanel → VPS → Browser terminal.
