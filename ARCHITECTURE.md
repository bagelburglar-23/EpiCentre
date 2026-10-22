# Architecture

The whole design exists to satisfy one requirement: **see something, decide it
needs a feature, ship it that day.** Everything below is downstream of that.

## Stack

| layer | choice | why |
|---|---|---|
| Framework | Next.js (App Router) | Server actions collapse the stack to 3 layers |
| Language | TypeScript | One language across server and client — no translation boundary |
| DB | SQLite (`better-sqlite3`) | Single user. Will never be the bottleneck. |
| ORM | Drizzle | TS-native schema, real migrations, no codegen step |
| Styling | Tailwind | |
| Components | shadcn/ui | Copied into the repo, not a dependency. Edit freely. |
| Delivery | PWA, installable | Home screen, no App Store review |
| Hosting | Hostinger KVM 2 VPS (Ubuntu 24.04, 2 vCPU / 8 GB) | Already paid for. Runs the prod instance as a `systemd` service. (D-15) |
| Ingress | Tailscale (`tailscale serve`) | Real HTTPS cert, PWA-installable origin, **nothing exposed to the public internet**. (D-15) |

**Layer count is the velocity metric.** A feature crosses schema → action →
component. Three. If you ever find yourself writing an API route to be called
by your own front-end, stop — that's a fourth layer with no purpose in a
single-user app.

> **D-13 scope.** "No API routes" governs *your own front-end*. A future agent
> (D-16) is a genuinely separate consumer on a separate process, and it does
> get a route — one generic, registry-driven handler, not one per module. That
> is not a fourth layer for the front-end; it is the front door for a different
> caller. See "Agent integration".

## The shape

```
app/                        Next.js routes (thin — re-exports only)
  (shell)/
    layout.tsx              nav, auth gate
    page.tsx                dashboard (calls each module's summary())
    ledger/page.tsx         3-line re-export from modules/ledger
  api/agent/[...]/route.ts  FUTURE (D-16) — one generic handler, registry-driven
lib/
  db.ts                     connection
  auth.ts                   getPrincipal(): reads the cookie (later: or an agent token)
  ics.ts                    pure RFC 5545 serialization (port of build_ics.py)
  (no schema.ts — drizzle-kit globs modules/**/schema.ts, D-17)
modules/
  registry.ts               the ONLY shell file touched when adding a module
  _template/                copy this to start a module (kept in sync with ledger)
  ledger/
    module.ts               client-safe manifest: id, label, icon, navOrder
    capabilities.ts         "server-only": summary(), later agentCapabilities()
    schema.ts               Drizzle tables, all prefixed ledger_ (+ created_at/updated_at)
    actions.ts              mutation core + "use server" adapters
    ui/                     components
drizzle/                    generated migrations — never hand-edit
deploy/                      systemd unit + post-receive hook (see "Hosting & deploy")
```

## The module contract

Four rules. These are the entire guarantee that feature #12 costs the same as
feature #2.

**1. No module imports another module.** Ever. Not types, not helpers, not
constants. The moment `guitar` imports from `ledger`, you have coupling and
the day-to-ship promise is dead. Shared things live in `lib/`.

**2. Every module owns its tables, prefixed with its id.** `ledger_entries`,
`guitar_sessions`. No shared `items` table. No generic tagged-entity model —
it looks flexible and produces a UI that can't do anything specific well.

**3. Adding a module touches exactly two shell files:** one line in
`modules/registry.ts`, one 3-line route re-export in `app/`. Nothing else.
The schema is picked up by a `drizzle-kit` glob (D-17), so there is no central
schema file to edit; the generated migration in `drizzle/` is output, not a
file you touch. **If a new module requires changing shell logic, the shell is
wrong** — fix the shell, don't work around it. This is the canary; take it
seriously.

**4. Cross-module and external access go through a published interface, never
module-to-module.** A module declares what it exposes; the shell mounts it for
whoever is asking — the dashboard today, an agent later (D-16). The shell may
know about modules; modules may not know about each other or about who is
calling. If the dashboard needs a count from three modules, each module's
`summary()` returns it and the shell aggregates.

### Capability publishing

`summary()` is the first instance of one pattern: **a module publishes a typed
interface; the shell decides who may call it.** The manifest is split so this
stays clean across the server/client boundary:

```ts
// modules/<id>/module.ts   — CLIENT-SAFE. The nav imports this.
export const manifest = {
  id: 'ledger',              // must equal the folder name and table prefix
  label: 'Ledger',
  icon: CalendarDays,        // lucide-react — a React component
  navOrder: 10,
} satisfies ModuleManifest

// modules/<id>/capabilities.ts   — SERVER-ONLY. import 'server-only' at the top.
export const capabilities = {
  summary: async () => ({ label: '3 upcoming', href: '/ledger' }),
  // agentCapabilities: { ... }   ← added at the agent phase, same shape, additive
}
```

**Why the split (idiom: "poisoned imports" / the `server-only` package).**
Next.js App Router renders on the server by default (**React Server
Components**). `icon` is a React component the client nav renders; `summary()`
touches SQLite and must never reach the browser bundle. Keeping them in one
object forces the whole thing to one side of the boundary. Two files, two
concerns.

`summary()` is optional — a module without one simply doesn't appear on the
dashboard.

### Actions: mutation core + adapter

Every mutation is written twice, ~3 lines apart:

```ts
// core — plain async, structured in/out, ALL validation here.
// No FormData, no cookies(), no redirect(). Callable by anyone server-side.
export async function addLedgerEntry(input: NewEntry): Promise<Entry> { ... }

// adapter — the thing a <form> calls.
export async function addLedgerEntryAction(formData: FormData) {
  'use server'
  const entry = await addLedgerEntry(parseForm(formData))
  revalidatePath('/ledger')
  return entry
}
```

This is not an abstraction layer — it is one named function. It pays for
itself inside Phase A: the seed importer and (later) an agent both call the
*core*, not a re-implementation of it. Mutations are idempotent on a natural
key where one exists (e.g. ledger: `label + month + day`), so re-running a
seed or an agent doesn't duplicate rows.

### `lib/` admission rule

`lib/` is **framework-generic only**: the DB connection, auth, date math, RFC
5545 serialization. Domain logic for one module never enters `lib/` — that is
module coupling with an extra hop. Test case: `lib/ics.ts` is pure calendar
serialization (any module could emit a calendar); `modules/ledger/` maps its
rows to events and calls it.

### Every module table carries `created_at` and `updated_at`

One line per table. Universally useful for ordering and "what changed", and
the hook an agent phase needs for provenance. A `source` column
(`'user'` | `'agent:<id>'`) is **not** added now — it is a clean nullable
column in a later generated migration if and when agents write.

### Adding a module — the checklist

1. `cp -r modules/_template modules/mealprep`
2. Edit `module.ts` — id, label, icon, navOrder
3. Define tables in `schema.ts`, prefix `mealprep_`, include `created_at`/`updated_at`
4. `npx drizzle-kit generate && npx drizzle-kit migrate` (the glob finds the new schema)
5. Write `capabilities.ts`, `actions.ts`, `ui/`
6. Add one line to `modules/registry.ts`
7. Add `app/(shell)/mealprep/page.tsx` — 3 lines

**If this takes more than a day, the abstraction is wrong.** That is the test,
and the second module is when you run it.

## Migrations

Generated by drizzle-kit, committed to git, **never hand-edited** (D-14).
`drizzle.config.ts` points `schema` at a glob — `./modules/**/schema.ts` — so a
new module's tables are discovered without editing a central file (D-17). Run
`generate` then `migrate`; the deploy script runs `migrate` on the VPS.

Watch for one SQLite sharp edge: drizzle-kit can't `ALTER` freely and will
prompt "is this a rename or a new column?" on ambiguous changes. Answer wrong
and it drops data. Read the generated SQL before committing.

## Auth

One password, checked against an env var (`APP_PASSWORD`), setting one signed
cookie. Middleware gates everything.

**The cookie is signed/verified with `jose`, not Node `crypto`.** Next.js
middleware runs on the Edge runtime, where Node built-ins and `better-sqlite3`
are unavailable. The check lives in **one** function — `lib/auth.ts`
`getPrincipal()` — called by middleware and by any handler. Don't inline
`cookies().get(...)` across components.

**No user table. No roles. No sessions table. No multi-tenancy** (D-11).
Single-user is a design advantage — most web tutorials will try to talk you
out of it. Ignore them. When agents arrive (D-16) they authenticate with
bearer tokens from an env var (`AGENT_TOKENS`); `getPrincipal()` grows one
branch. Still no user table — a token is config, not a person.

## Notifications

**The app does not own alerting.** The ledger module exports `.ics`; Google
Calendar fires the alerts. Web push on iOS is the least reliable channel
available and "never miss a birthday" is the one feature that must not fail.

`bin/build_ics.py` is the **reference implementation** for the export — it is
tested, RFC 5545-correct, and handles the parts that are easy to get wrong
(octet-based line folding, escaping, stable UIDs, VTIMEZONE). Port its logic to
TS; don't reinvent it from the spec.

## Hosting & deploy

**Two instances, one codebase.**

| | dev | prod |
|---|---|---|
| where | your laptop | the VPS |
| command | `npm run dev` (hot reload) | `npm run build` then run under `systemd` |
| origin | `http://localhost:3000` | `https://srv1648855.<tailnet>.ts.net` |
| DB | `epicentre.dev.db` (gitignored) | `/var/lib/epicentre/epicentre.prod.db` |
| reachable from | the laptop only | any device on the tailnet |

Code moves dev → prod through **git**. Data does not move — the seed
(`state/ledger.md` → SQLite) runs once per instance.

**On the VPS:**

```
/opt/epicentre/          git checkout + .next build output   (owned by a non-root deploy user)
/var/lib/epicentre/      epicentre.prod.db + nightly *.backup dumps (7-day retention)
/etc/epicentre.env       APP_PASSWORD, SESSION_SECRET, DATABASE_PATH   (chmod 600)
/etc/systemd/system/epicentre.service   ~15-line unit: runs node, restarts on crash + on boot
```

- **`systemd`** is the Linux service manager. The unit file says what to run,
  as whom, with which env file, and "keep it up". `systemctl restart epicentre`;
  `journalctl -u epicentre` for logs.
- **`tailscale serve https / http://127.0.0.1:3000`** terminates HTTPS on the
  VPS's tailnet hostname (real cert, auto-renewed) and forwards to the local
  app. Ports 80/443 are **not** opened; `ufw` blocks all inbound except SSH.
- **Deploy** is `git push vps main`. A bare repo on the VPS
  (`/opt/epicentre.git`) has a `post-receive` hook (`deploy/post-receive`)
  that checks out, `npm ci`, builds, and restarts the `systemd` service —
  its output streams back into the `git push` you ran. One command, and you
  watch it finish. This is still a human choosing to push, not a scheduled
  pull — see `decisions.md`/`threads.md` for why that distinction matters
  once migrations are interactive. Auto-deploy-on-a-schedule stays backlogged.
- Node is installed from the **NodeSource** apt repo (LTS). `better-sqlite3`
  compiles a native binary on `npm ci`; the VPS needs `build-essential` +
  `python3` (present).
- **Backups:** Hostinger takes weekly VM backups (a floor). On top, a nightly
  `sqlite3 .backup` cron keeps 7 daily copies — a ledger you re-enter by hand
  is worth not losing.

## Agent integration (future — D-16)

Not built in Phase A. The design keeps the door open at near-zero cost; the
semantics wait (see decisions.md "Open").

**The surface, when it comes:**

- Agents are **separate processes/containers on the VPS** (Docker is already
  installed for exactly this). They are not run in-process by the Next.js
  app, and they never `import` a module or open the SQLite file directly —
  that would recreate the coupling D-10 forbids.
- They call **one generic route** — `app/api/agent/[...]/route.ts` — that
  authenticates a bearer token (`getPrincipal()`), looks up the target module
  in `registry.ts`, and invokes a declared `agentCapabilities` entry. Adding a
  module still touches only its own files plus the two shell files; the agent
  route is written once and never per-module.
- Capabilities reuse the **mutation core** (`addLedgerEntry`, not the form
  adapter) and its idempotency key, so an agent and the UI can't diverge.
- Traffic stays on the tailnet or VPS-localhost. Nothing new is exposed.

**Explicitly deferred:** the agent route itself, `AGENT_TOKENS`, a
task / pending-change model, a `source` column, any worker process or queue,
containerizing the app. All in `BACKLOG.md`.

## Still open

- Offline writes. PWA shell caching is easy; offline writes need conflict
  resolution. Not until it hurts.
- Sync across devices. Multiple devices already *read* one SQLite file over
  the tailnet; a second *writer* is the hard part.
