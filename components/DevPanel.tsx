"use client";
/* eslint-disable react/no-unescaped-entities -- this is a prose-heavy doc
   component; raw apostrophes in copy are intentional and readable. */

import { useEffect, type ReactNode } from "react";
import { consumePendingSection } from "@/lib/nav-bus";

// EpiDev - the living developer tab. Three sections (Frontend guide,
// Infrastructure, Patch notes), all built from native <details> so they are
// collapsible with no extra state. Infra chapters link to patch notes via
// PatchLink, which opens the target patch (and its ancestor sections) and
// scrolls to it. Content here describes the CURRENT app; development history
// lives in the patch trail, which the other two sections tag rather than
// retell. Updated as development proceeds.

function openAncestors(el: HTMLElement) {
  let n: HTMLElement | null = el;
  while (n) {
    if (n.tagName === "DETAILS") (n as HTMLDetailsElement).open = true;
    n = n.parentElement;
  }
}

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  openAncestors(el);
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function jumpToPatch(pr: number) {
  jumpTo(`patch-${pr}`);
}

// A compact chip that jumps to a patch note.
function PatchLink({ pr }: { pr: number }) {
  return (
    <button
      onClick={() => jumpToPatch(pr)}
      className="mx-0.5 rounded bg-accent-dim px-1 font-mono text-[10px] text-accent-bright hover:bg-accent hover:text-black"
      title={`Jump to patch #${pr}`}
    >
      #{pr}
    </button>
  );
}

function PatchLinks({ prs }: { prs: number[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-0.5 font-mono text-[10px] text-foreground/40">
      <span>patches:</span>
      {prs.map((p) => (
        <PatchLink key={p} pr={p} />
      ))}
    </div>
  );
}

// Section: a top-level collapsible, open by default.
function Section({
  title,
  subtitle,
  children,
  open = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="mb-2 rounded border border-accent-dim bg-black/40"
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-accent-bright marker:content-none">
        <span className="mr-1 inline-block">▸</span>
        {title}
        {subtitle && (
          <span className="ml-2 font-sans text-xs lowercase tracking-normal text-foreground/40">
            {subtitle}
          </span>
        )}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

// A collapsible chapter/subsection inside a Section.
function Item({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} className="mt-1.5 rounded border border-accent-dim/60">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 text-sm text-foreground marker:content-none">
        <span className="mr-1 inline-block text-accent-bright">▸</span>
        {title}
      </summary>
      <div className="space-y-2 px-3 py-2 text-sm text-foreground/75">
        {children}
      </div>
    </details>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-4 list-disc space-y-1">{children}</ul>;
}

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-accent-dim/50 px-1 text-[0.85em] text-accent-bright">
    {children}
  </code>
);

// --- Patch trail: newest first. Descriptions of pre-#15 PRs are
// reconstructed from the repo; the recent ones are precise. ---
const PATCHES: { pr: number; name: string; body: ReactNode }[] = [
  { pr: 36, name: "EpiSplit grid nav + tax defaults", body: "Full spreadsheet keys in the grid: arrow keys move cell-to-cell (↓ / Enter go down; ←/→ hop columns only at the text edge, so you can still edit within a cell), Ctrl/Cmd+arrows jump to the first/last row or column, Ctrl/Cmd+D fills a column. Tax defaults to 20% for new items and scanned batches (inheriting the last item's rate when it has one); a scanned batch autofills its rate once, then each item is editable." },
  { pr: 35, name: "EpiSplit grid + OCR polish", body: "Receipt parser now handles S$/SGD prefixes and multi-column POS layouts (the printed-receipt failure was the parser, not OCR), and images are greyscaled/upscaled/contrast-boosted before tesseract (+PSM) for better reads. Tax carries over: new items inherit the last tax rate, scanned batches share one tax. Grid keyboard nav — Ctrl/Cmd+↑/↓ jump to first/last row, Ctrl/Cmd+D fills a column (fast tax fill). Bulk delete — checkboxes on desktop; on mobile a row's ✕ opens WhatsApp-style multi-select." },
  { pr: 34, name: "Split-screen", body: "Use two modules at once: the ⊟ toggle (sidebar on desktop, title bar on mobile) opens a second pane — side by side on desktop, stacked on mobile — each scrolling on its own, with its own module picker. The sidebar/bottom-nav still drives the main pane; ✕ closes the second." },
  { pr: 33, name: "OCR input sources", body: "Desktop scans from the clipboard — paste a copied receipt image or press Cmd/Ctrl+V, no file dialog. Mobile's picker now offers both the photo gallery and the camera (removed the camera-only lock)." },
  { pr: 32, name: "EpiSplit receipt OCR", body: "Scan a receipt photo to add items: tesseract.js reads it entirely in the browser (no AI tokens, no server), a heuristic parser pulls name+price lines, and you review/untick/edit them before they're added. First scan downloads the English model (~a couple MB), cached after." },
  { pr: 31, name: "Lock zoom + stop review requests", body: "Disable pinch-zoom on mobile so the app stays put like a native shell (pairs with the #29 viewport lock); drop the automatic PR review-request step — no more GitHub review pings, just open the PR and hit merge." },
  { pr: 30, name: "EpiCal two-way Google edit", body: "Events pulled from Google can be edited and deleted from Cal+ too - the change PATCH/DELETEs the event on its own Google calendar and mirrors into the local cache. Activates once this reaches prod and the sync tags each cached event with its calendar id." },
  { pr: 29, name: "Mobile layout overhaul", body: "Lock the app to the viewport like a native shell (no floating, no rubber-band bounce, no accidental horizontal swipe); tint the pinned Refresh/Settings cluster so scrolling modules don't look glitchy behind it; show list/bill rename+delete buttons on mobile (no hover there); larger base font on phones." },
  { pr: 28, name: "UX tweaks: Dump, list delete choice, collapsible rails", body: "Rename the Inbox list to Dump (non-deletable); deleting a list asks whether to move its items to Dump or delete them too; EpiList/EpiSplit rails collapse; bills delete without a confirm; whole-app Refresh button." },
  { pr: 27, name: "Per-module '?' deep-links", body: "A '?' in each module header opens EpiDev scrolled to that module's guide, via a tiny client nav-bus + a Shell listener." },
  { pr: 26, name: "Bottom nav drops the Epi prefix", body: "Bottom-nav labels read List / Cal / Split / …; the full EpiX name stays in the mobile title bar." },
  { pr: 25, name: "EpiDev — the living developer tab", body: "This tab: Frontend guide, Infrastructure (with the D- decisions and patch cross-links), and this patch trail." },
  { pr: 24, name: "EpiSplit — bill splitting", body: "New Bills module: people as columns, items as rows, cost + tax% per item and each person's share units; tax-inclusive cost split by shares, totals live. Stored as a JSON document per bill; verified against the manual Excel." },
  { pr: 23, name: "Mobile title bar + EpiX naming; Settings pinned", body: "Mobile title bar (clears the iOS status bar) names the current module. EpiX naming across modules (EpiList, EpiCal, EpiTrader, EpiPlanner) with 2-letter nav glyphs. Settings is the exception: a ☰ glyph pinned static while the others scroll." },
  { pr: 22, name: "Mobile-friendly shell", body: "App-style bottom navigation on phones instead of the cramped sidebar; full-width content, safe-area padding, 100dvh so browser chrome doesn't clip the nav." },
  { pr: 21, name: "Cal+ → Google write-back", body: "Editing or deleting an EpiCentre-origin event now PATCHes/DELETEs it on Google too (best-effort). Google-sourced events stay read-only." },
  { pr: 20, name: "EpiTrader + EpiPlanner shells", body: "Two placeholder modules. EpiTrader states its D-08 boundary (personal only, no desk content); EpiPlanner lists proposed planner features." },
  { pr: 19, name: "Lists — multi-list To-Do", body: "To-Do became Lists: a list rail (Inbox + named lists), create/rename/delete, and a List selector in the item modal to move items. Nullable list_id = Inbox, so existing items needed no migration." },
  { pr: 18, name: "Housekeeping: reminders 16:00 HKT, guardrails in repo", body: "Telegram reminder time 09:00→08:00 UTC (16:00 HKT). ~/.claude/settings.json copied into the repo so the deny-rule guardrails survive a VPS rebuild." },
  { pr: 17, name: "Nightly encrypted off-VPS backup", body: "age-encrypted nightly copy of the shared DB pushed to a private repo (secret key lives only in the password manager); 14 local dailies. Prod deploy now installs systemd units from the repo." },
  { pr: 16, name: "To-Do: bullet details, collapse, edit", body: "Item details render \"- \" lines as bullets and collapse behind a ▸; tap a title to edit title/details/due date. Changing the due date re-arms the reminder." },
  { pr: 15, name: "Mobile workflow + VPS deploy docs", body: "Real VPS deploy docs (deploy/README.md), a CLAUDE.md mobile-workflow section, and the preview workflow requesting review after UAT so a phone notification means \"ready\"." },
  { pr: 14, name: "Cal+ views + multi-calendar", body: "Month/Week/Day views, day drill-down and event editing in Cal+; pulls every Google calendar (not just primary); drag-reorder for open tabs." },
  { pr: 13, name: "In-app password change (v2)", body: "Change the app password from inside the app (show/hide toggle), stored hashed in the DB - no SSH needed. Supersedes the reverted v1." },
  { pr: 12, name: "Revert password-change v1", body: "Reverted #10 after an issue; reworked as #13." },
  { pr: 10, name: "In-app password change (v1)", body: "First cut of the in-app password change (later reverted and redone)." },
  { pr: 9, name: "Fix Google OAuth callback", body: "The OAuth callback was resolving to localhost:3000 instead of the tailnet hostname; fixed the redirect so Google connect completes in the browser." },
  { pr: 8, name: "Google Calendar sync (v1)", body: "Connect Google (OAuth), pull events into a read-only local cache, and push new EpiCentre events to Google. One shared refresh token in the DB." },
  { pr: 7, name: "Auth gate", body: "One password, one signed (jose) cookie, middleware gating every route. No user table (D-11)." },
  { pr: 6, name: "Reset UAT to main on merge", body: "After a merge to main, UAT rebuilds from main so the accent turns grey (= same code as prod)." },
  { pr: 5, name: "Cal+ base", body: "The calendar module's foundation: the events table and the initial calendar view." },
  { pr: 4, name: "To-Do + Shell (iteration)", body: "Refinements to the first module and the tabbed shell." },
  { pr: 3, name: "To-Do + Shell (iteration)", body: "Continued build of the To-Do module and the VS Code-style tab shell." },
  { pr: 2, name: "To-Do + Shell", body: "The first real module (To-Do) and the sidebar + tab Shell it mounts into." },
  { pr: 1, name: "Review pipeline", body: "The review-gated deploy pipeline: push a feature branch → UAT; merge to main → prod. The spine everything else ships through." },
];

export default function DevPanel() {
  // When opened via a module's "?", scroll to that module's guide section.
  // Runs on mount because the Shell mounts this panel fresh each time EpiDev
  // becomes active; a short delay lets the <details> render first.
  useEffect(() => {
    const section = consumePendingSection();
    if (!section) return;
    const t = setTimeout(() => jumpTo(section), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-1 font-mono text-sm uppercase tracking-wide text-accent-bright">
        EpiDev
      </h1>
      <p className="mb-4 text-sm text-foreground/60">
        How the app works and how it was built. Three living sections — the
        guide and infrastructure describe the current app; the patch trail is
        the history they link to. Updated as development continues.
      </p>

      {/* ============ 1. FRONTEND GUIDE ============ */}
      <Section title="Frontend guide" subtitle="each module, and how to use it" open>
        <Item title="EpiList — lists & to-dos" id="guide-lists">
          <P>Multiple named lists plus an always-present <strong>Inbox</strong> for unfiled items.</P>
          <UL>
            <li>Pick a list in the left rail; the count is open (undone) items.</li>
            <li><C>+ List</C> to create; hover a list for ✎ rename / ✕ delete (deleting sends its items back to the Inbox).</li>
            <li><C>+ Add</C> an item: title, details, due date, and which list. In details, lines starting with <C>-</C> render as bullets; they collapse behind ▸.</li>
            <li>Tap an item's title to edit it — including moving it to another list via the List dropdown.</li>
            <li>A due date drives the daily Telegram reminder (16:00 HKT).</li>
          </UL>
          <PatchLinks prs={[19, 16]} />
        </Item>

        <Item title="EpiCal — calendar" id="guide-calplus">
          <P>Your events plus your Google calendars in one place.</P>
          <UL>
            <li>Month / Week / Day views; click a day to drill in.</li>
            <li>Create, edit and delete events. An event you create here is pushed to Google; editing or deleting it updates Google too.</li>
            <li>Events pulled from Google (every calendar, incl. Birthdays) show prefixed <C>G</C>; tap one to edit or delete it — the change syncs to that Google calendar. (Editing a "G" event activates after the sync tags it with its calendar id.)</li>
          </UL>
          <PatchLinks prs={[14, 21, 30, 8, 9]} />
        </Item>

        <Item title="EpiSplit — bills" id="guide-bills">
          <P>Split a bill among friends, like the spreadsheet — but it does the math.</P>
          <UL>
            <li><C>+ Bill</C> in the rail, then <C>+ Person</C> (columns) and <C>+ Item</C> (rows).</li>
            <li>Per item: cost, tax %, and each person's <em>share units</em> (leave blank = not sharing).</li>
            <li>Each item's tax-inclusive cost is split in proportion to shares; the <strong>Owed</strong> row shows each person's total, live. Edits autosave.</li>
            <li><strong>Scan receipt:</strong> on mobile snap a photo or pick from your gallery; on desktop paste a copied image (Cmd/Ctrl+V). OCR runs in your browser (no AI tokens) and pulls the line items to review/edit before adding; set one tax % for the whole receipt in that modal. First scan downloads a small English model, then it's cached.</li>
            <li><strong>Tax:</strong> defaults to 20%; a new item (or scanned batch) inherits the last item's rate when it has one. A scanned batch sets its rate once, then each item is editable.</li>
            <li><strong>Fast entry (desktop):</strong> arrow keys move between cells (↓ or Enter to go down; ←/→ hop columns at the text edge), Ctrl/Cmd+arrows jump to the first/last row or column, and Ctrl/Cmd+D fills the focused column (one tax for all).</li>
            <li><strong>Bulk delete:</strong> tick rows (desktop checkboxes) or tap a row's ✕ to start selecting (mobile), then Delete.</li>
          </UL>
          <PatchLinks prs={[24, 32, 33, 35]} />
        </Item>

        <Item title="EpiTrader — personal portfolio (shell)" id="guide-epitrader">
          <P>Placeholder. Will link to a <strong>personal</strong> IBKR + an external portfolio system. By <strong>D-08</strong> it never holds desk/book content (positions, sizes, client flow, P&amp;L from work).</P>
          <PatchLinks prs={[20]} />
        </Item>

        <Item title="EpiPlanner — trip/day planner (shell)" id="guide-epiplanner">
          <P>Placeholder with a proposed feature list (link stash, itinerary board, time-blocking, push-a-day-to-EpiCal, templates).</P>
          <PatchLinks prs={[20]} />
        </Item>

        <Item title="Settings" id="guide-settings">
          <P>Change the app password from any logged-in device (no SSH). One password shared by prod and UAT. Pinned as ☰ in the nav.</P>
          <PatchLinks prs={[13]} />
        </Item>
      </Section>

      {/* ============ 2. INFRASTRUCTURE ============ */}
      <Section title="Infrastructure" subtitle="the invisible backend — read slowly">
        <Item title="How a module is built">
          <P>
            The app diverged from the original <C>ARCHITECTURE.md</C> plan (no{" "}
            <C>modules/</C> folder, no Drizzle). The <em>real</em> pattern, four
            files per module:
          </P>
          <UL>
            <li><C>lib/&lt;name&gt;.ts</C> — data layer: types + read/mutation functions over SQLite.</li>
            <li><C>app/&lt;name&gt;/actions.ts</C> — thin <C>&quot;use server&quot;</C> adapters that call the data layer and <C>revalidatePath</C>.</li>
            <li><C>components/&lt;Name&gt;Panel.tsx</C> — the <C>&quot;use client&quot;</C> UI.</li>
            <li><C>app/page.tsx</C> — one entry registering the tab in the Shell.</li>
          </UL>
          <P>The rule that still holds from the plan: <strong>no module imports another</strong> (D-10); shared code lives in <C>lib/</C>. Tables carry <C>created_at</C>/<C>updated_at</C> and an <C>is_test</C> flag.</P>
        </Item>

        <Item title="Hosting & network">
          <UL>
            <li>Hostinger VPS (Ubuntu 24.04), app runs as <C>systemd</C> user services under user <C>claude</C>.</li>
            <li>Reachable <strong>only over the Tailscale tailnet</strong> — nothing exposed to the public internet. <C>tailscale serve</C> terminates real HTTPS: <C>/</C>→prod (3000), <C>:8443</C>→UAT (3001).</li>
            <li>The machine's Tailscale name <em>is</em> the app's hostname — don't rename it.</li>
          </UL>
          <PatchLinks prs={[15]} />
        </Item>

        <Item title="Deploy pipeline">
          <P>Code moves by git; GitHub Actions deploys over SSH.</P>
          <UL>
            <li>Push <C>feature/**</C> (or <C>claude/**</C>) → a PR auto-opens, requests your review, and <strong>UAT</strong> rebuilds (accent <strong>blue</strong>).</li>
            <li>Merge to <C>main</C> → <strong>prod</strong> rebuilds (accent <strong>red</strong>), then UAT resets to main (<strong>grey</strong> = same as prod).</li>
            <li>The prod deploy also installs systemd units from <C>deploy/systemd-user/</C>, so new timers/services go live on merge.</li>
            <li><C>main</C> is protected (PR required, no force-push); the VPS deploy key can't bypass it.</li>
          </UL>
          <PatchLinks prs={[1, 6, 15, 17]} />
        </Item>

        <Item title="Database">
          <P>One SQLite file (<C>better-sqlite3</C>, WAL) at <C>~/shared/epicentre.db</C>, <strong>shared by prod and UAT</strong>.</P>
          <UL>
            <li><strong>D (shared DB):</strong> kept deliberately. Single-user + WAL-safe; <C>is_test = 1</C> rows are hidden from prod so UAT can test against real data. Separate DBs were rejected (doubles backup/migration surface, loses the shared-data benefit).</li>
            <li>Schema changes are <strong>additive only</strong> (new tables / <C>ALTER TABLE ADD COLUMN</C>) in <C>lib/db.ts</C> — a destructive change would break the other environment instantly.</li>
          </UL>
        </Item>

        <Item title="Auth">
          <P>One password (D-11: no users, no roles). It's hashed in the DB (changeable in Settings), with a signed <C>jose</C> JWT cookie; middleware gates every route. Changing the password does <em>not</em> log out other devices — rotating <C>SESSION_SECRET</C> does.</P>
          <PatchLinks prs={[7, 13]} />
        </Item>

        <Item title="Google Calendar">
          <UL>
            <li>OAuth with scopes <C>calendar.events</C> (write) + <C>calendar.readonly</C>. One refresh token in the DB, shared by prod/UAT.</li>
            <li>A timer pulls every calendar into a read-only cache every 30 min; EpiCentre-origin events push/patch/delete to Google live.</li>
            <li><strong>D (OAuth routes):</strong> D-13 says &quot;server actions, not API routes&quot; — but an OAuth callback is an external GET redirect from Google that a server action can't receive, so the <C>/api/auth/google/*</C> routes are an allowed exception.</li>
            <li>The redirect URL is hard-coded to the prod hostname, so connect Google from prod.</li>
          </UL>
          <PatchLinks prs={[8, 9, 14, 21]} />
        </Item>

        <Item title="Reminders">
          <P>A daily timer (16:00 HKT = 08:00 UTC) sends due-soon to-dos to Telegram.</P>
          <UL>
            <li><strong>D (Telegram vs D-12):</strong> D-12 says &quot;the app doesn't own alerting&quot; — its real concern was unreliable iOS web-push. Telegram is server-initiated and reliable, so it's kept as a <em>secondary</em> nudge; Google Calendar (.ics) stays the authoritative channel. This partially supersedes D-12.</li>
          </UL>
          <PatchLinks prs={[18]} />
        </Item>

        <Item title="Backups">
          <P>Nightly (18:00 UTC): integrity-check → consistent copy → <strong>age-encrypt</strong> → push to a private repo; 14 plaintext dailies kept locally. The VPS holds only the <em>public</em> key, so it can back up but never decrypt — the secret key lives only in the password manager.</P>
          <PatchLinks prs={[17]} />
        </Item>

        <Item title="Other standing decisions (D-)">
          <P>The canonical list is <C>state/decisions.md</C>. The load-bearing ones:</P>
          <UL>
            <li><strong>D-08</strong> — no desk/book content, ever (positions, P&amp;L, client flow). The hard line for EpiTrader.</li>
            <li><strong>D-10</strong> — no module imports another; shared code in <C>lib/</C>.</li>
            <li><strong>D-11</strong> — single-user: one password, no user table.</li>
            <li><strong>D-15</strong> — prod on the VPS, tailnet-only; dev is localhost; code moves by git, data doesn't.</li>
            <li><strong>D-16</strong> — future agents run as separate VPS processes, reaching the app only through an authenticated interface (not built yet).</li>
          </UL>
        </Item>
      </Section>

      {/* ============ 3. PATCH NOTES ============ */}
      <Section title="Patch notes" subtitle="every PR, newest first">
        {PATCHES.map((p) => (
          <details
            key={p.pr}
            id={`patch-${p.pr}`}
            className="mt-1.5 scroll-mt-4 rounded border border-accent-dim/60"
          >
            <summary className="cursor-pointer list-none px-2.5 py-1.5 text-sm marker:content-none">
              <span className="mr-1 inline-block text-accent-bright">▸</span>
              <span className="rounded bg-accent-dim px-1 font-mono text-[11px] text-accent-bright">
                #{p.pr}
              </span>{" "}
              <span className="text-foreground">{p.name}</span>
            </summary>
            <div className="px-3 py-2 text-sm leading-relaxed text-foreground/75">
              {p.body}
            </div>
          </details>
        ))}
      </Section>
    </div>
  );
}
