# Deploy

One-time VPS setup, then an ordinary `git push` deploys every time after.

## One-time VPS setup

SSH in (`ssh root@72.62.248.178`), update + reboot first if a kernel update
is pending:

```bash
apt update && apt upgrade -y && reboot
```

Reconnect, then paste this whole block:

```bash
# Node 22 LTS + build tools
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs build-essential

# system account that only runs the app (no login, no home dir)
adduser --system --group --no-create-home deploy

# bare repo you push to, and the working copy it deploys into
git init --bare -b main /opt/epicentre.git
mkdir -p /opt/epicentre

# deploy hook: on every push, checkout + install + build + restart
cat > /opt/epicentre.git/hooks/post-receive << 'EOF'
#!/bin/bash
set -e
WORK=/opt/epicentre
export GIT_WORK_TREE=$WORK
git checkout -f main
unset GIT_WORK_TREE
cd "$WORK"
npm ci
npm run build
chown -R deploy:deploy "$WORK"
systemctl restart epicentre
echo "Deployed $(git rev-parse --short HEAD)"
EOF
chmod +x /opt/epicentre.git/hooks/post-receive

# systemd service — keeps the app up, restarts on crash and on boot
cat > /etc/systemd/system/epicentre.service << 'EOF'
[Unit]
Description=EpiCentre
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/epicentre
EnvironmentFile=-/etc/epicentre.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable epicentre

# firewall — SSH only; Tailscale needs neither 80 nor 443
ufw allow OpenSSH
ufw --force enable

# Tailscale — private HTTPS ingress, nothing public
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

echo "---- versions ----"; node -v; npm -v; docker --version
echo "---- firewall ----"; ufw status
echo "---- tailscale ----"; tailscale status
```

`tailscale up` prints an auth URL and waits — open it, sign in (or create a
free account), approve the machine. `tailscale status` then shows it
connected.

**Publish the app on the tailnet** (one more one-time command, after the
first deploy below has happened at least once so port 3000 is listening):

```bash
tailscale serve --bg 3000
```

Find the URL with `tailscale status` or the admin console
(https://login.tailscale.com/admin/machines) — it's
`https://srv1648855.<your-tailnet-name>.ts.net`.

## Every deploy after that

From the laptop, one time only:

```powershell
git remote add vps ssh://root@72.62.248.178/opt/epicentre.git
```

Then, whenever you want prod to catch up:

```powershell
git push vps main
```

The hook runs on the VPS and streams its output (`npm ci`, build, restart)
back into this same command. No separate SSH step.

## Secrets

`/etc/epicentre.env` on the VPS (not in git) holds `APP_PASSWORD`,
`SESSION_SECRET`, `DATABASE_PATH` once the password gate and database exist.
The systemd unit loads it with `EnvironmentFile=-/etc/epicentre.env` — the
leading `-` makes it optional, so the service starts fine before that file
exists.

## Known shortcut — not hardened yet

Pushes are received as `root` (the hook runs as whoever owns the SSH
session), so `npm ci`/`npm run build` run as root; only the running service
itself drops to the unprivileged `deploy` system account. Fine for a
single-user tailnet-only box; a non-root deploy *user* for pushing too is a
quick follow-up, not a blocker.
