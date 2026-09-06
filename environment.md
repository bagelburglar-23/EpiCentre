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
| Hosting | Hostinger KVM 2 VPS — prod instance as a `systemd` service (D-15) |
| Ingress | Tailscale `tailscale serve` — real HTTPS, tailnet-only, no public ports |
| Editor | VS Code + Claude Code extension |

Node on the VPS: NodeSource apt repo, LTS. `better-sqlite3` compiles a native
binary at `npm ci` — needs `build-essential` + `python3` (present).

## VPS

| item | detail |
|---|---|
| Plan | Hostinger KVM 2 — 2 vCPU, 7.8 GB RAM, 96 GB NVMe, 8 TB bandwidth |
| OS | Ubuntu 24.04.4 LTS, systemd 255, full root |
| Location | Kuala Lumpur (UTC+8, no DST — matches the ledger's alert timezone) |
| Hostname | `srv1648855.hstgr.cloud` (public); a `*.ts.net` name once Tailscale is up |
| Backups | Hostinger weekly VM backup + 1 snapshot slot; plus a nightly `sqlite3 .backup` cron |
| Docker | installed and kept — reserved for future agent workers (D-16), not for the app |
| Firewall | `ufw` — inbound SSH only; 80/443 stay closed (Tailscale needs neither) |
| History | shipped with a Hostinger one-click "openclaw" agent stack; removed before Phase A |

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
