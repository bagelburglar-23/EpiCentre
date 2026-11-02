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
| Timers | `sync-google-events.timer` every 30 min · `send-reminders.timer` daily 08:00 **UTC** (= 16:00 HKT) · `epicentre-backup.timer` daily 18:00 UTC |
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

`systemd-user/` is the source of truth. The **prod deploy installs them**:
each merge to `main` copies `deploy/systemd-user/*` into
`~/.config/systemd/user/` and runs `daemon-reload`, so adding or changing a
unit there goes live on merge (a running unit keeps running; only
`epicentre` is restarted). A new *service* still needs a one-line
`systemctl --user enable --now <unit>` the first time (the backup timer is
already wired into the deploy). For an urgent hand-edit on the box, change
the live file, `daemon-reload && restart <unit>`, then copy it back here or
the next deploy reverts it.

## Claude guardrails

The deny/allow rules that keep the Claude session off prod secrets, the DB
and `main` live in `~/.claude/settings.json` (user-level, not in git by
nature). A reference copy is kept at `deploy/claude-settings.json`. After a
VPS rebuild, restore them before running Claude there:

```bash
mkdir -p ~/.claude && cp deploy/claude-settings.json ~/.claude/settings.json
```

They are guardrails, not a security boundary — the session runs as `claude`
and could reach those files if a rule were missing. The real boundary is a
separate Linux user (backlog).

## Backups

Nightly encrypted copy of `~/shared/epicentre.db` to a **private** GitHub
repo, plus 14 plaintext dailies kept on the VPS in `~/backups`.
`scripts/backup-db.mjs` runs from `epicentre-backup.timer` (18:00 UTC =
02:00 HKT). It is **off** until bootstrapped — until then it logs "not
configured" and exits 0.

How it protects the data: the VPS holds only the age **public** key, so it
can make backups but cannot read them back. The **secret** key lives only in
Lucas's password manager; it is the one thing that can decrypt a backup, and
it is never on the VPS. The app repo is public, so backups go to a separate
private repo and are encrypted regardless.

One file holds everything both environments use — to-dos, Cal+ events, the
Google refresh token, the app-password hash — so **treat a backup like a
secret** and never commit one to the public app repo.

### Bootstrap (one time, needs a shell on the VPS)

```bash
# 1. install the age binary (not in git; reinstall after a VPS rebuild)
curl -fsSL https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-amd64.tar.gz \
  | tar -xz -C /tmp && install -m755 /tmp/age/age /tmp/age/age-keygen ~/.local/bin/

# 2. make the keypair. PRINT THE SECRET KEY ONCE, store it in the password
#    manager, then remove it from the VPS. Keep only the public line here.
age-keygen -o /tmp/epicentre-age.key          # prints "Public key: age1..."
grep -v '^#' /tmp/epicentre-age.key            # the AGE-SECRET-KEY-1... line -> password manager
#    ... copy it to the password manager now ...
shred -u /tmp/epicentre-age.key                # the VPS keeps no secret key

# 3. create a PRIVATE GitHub repo `epicentre-backups` (GitHub app/web), then
#    add the VPS deploy key to it with WRITE access:
cat ~/.ssh/id_ed25519.pub                       # -> repo Settings -> Deploy keys (Allow write)
git clone git@github.com:bagelburglar-23/epicentre-backups.git ~/epicentre-backups

# 4. point the backup at the recipient + repo (public key is not a secret)
cat > ~/epicentre-backup.env <<'ENV'
BACKUP_AGE_RECIPIENT=age1...        # the "Public key" from step 2
BACKUP_REPO_DIR=/home/claude/epicentre-backups
ENV
chmod 600 ~/epicentre-backup.env

# 5. start it and prove tonight's run will work
systemctl --user enable --now epicentre-backup.timer
systemctl --user start epicentre-backup.service     # run once now
journalctl --user -u epicentre-backup -n 20 --no-pager
```

### Restore

Decrypt on whatever machine does the restore (needs the secret key from the
password manager), then follow *Data → Restore* in the Emergency Recovery
Manual:

```bash
age -d -i epicentre-age.key -o epicentre.db epicentre-2026-11-01.db.age
```

The backup repo's git history keeps every daily forever, so it grows over
time; pruning old history is a backlog item, not urgent for a small DB.

## Commands

```bash
systemctl --user status epicentre epicentre-preview claude-rc
journalctl --user -u epicentre -n 100 --no-pager
journalctl --user -u claude-rc -n 50 --no-pager
journalctl --user -u epicentre-backup -n 20 --no-pager
systemctl --user list-timers
tailscale serve status
```

## Access

`ssh claude@100.65.233.34` — key auth only (laptop alias: `ssh epic`).
Root has a password (reset in hPanel) and is rarely needed. Fallback with
no keys at all: hPanel → VPS → Browser terminal.
