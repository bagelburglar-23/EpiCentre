// Nightly off-VPS backup of the shared SQLite database.
//
// What it does, in order:
//   1. integrity-check ~/shared/epicentre.db (abort loudly if malformed)
//   2. take a consistent copy with SQLite's online-backup API (safe while
//      prod + UAT are running; WAL-aware - a plain `cp` is not)
//   3. age-encrypt that copy to a PUBLIC recipient key. The matching secret
//      key lives only in Lucas's password manager, so the VPS can make
//      backups but can never read them back - a VPS compromise does not
//      expose old backups.
//   4. commit + push the encrypted copy to a PRIVATE GitHub repo (separate
//      from the app repo, which is public)
//   5. keep the last N plaintext dailies locally in ~/backups for fast
//      same-box restore (no new exposure: the live DB is already plaintext
//      here), and the last N encrypted files in the backup repo's worktree.
//
// Before bootstrap (no recipient key / no backup-repo clone) it logs one
// line and exits 0, so the nightly timer does not spam failures.
//
// Config (env, all optional - see deploy/README.md "Backups"):
//   DATABASE_PATH         default ~/shared/epicentre.db
//   BACKUP_AGE_RECIPIENT  age1... public key; unset => "not configured"
//   BACKUP_REPO_DIR       git clone w/ push access; unset => "not configured"
//   BACKUP_LOCAL_DIR      default ~/backups
//   BACKUP_KEEP           default 14
//   AGE_BIN               default "age" (resolved on PATH)

import { homedir } from "node:os";
import { join } from "node:path";
import {
  mkdirSync,
  readdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const HOME = homedir();
const DB_PATH = process.env.DATABASE_PATH || join(HOME, "shared", "epicentre.db");
const RECIPIENT = process.env.BACKUP_AGE_RECIPIENT || "";
const REPO_DIR = process.env.BACKUP_REPO_DIR || "";
const LOCAL_DIR = process.env.BACKUP_LOCAL_DIR || join(HOME, "backups");
const KEEP = Number(process.env.BACKUP_KEEP || "14");
const AGE_BIN = process.env.AGE_BIN || "age";

const DAY = new Date().toISOString().slice(0, 10); // UTC, byte-stable
const NAME_RE = /^epicentre-\d{4}-\d{2}-\d{2}\.db$/;
const AGE_RE = /^epicentre-\d{4}-\d{2}-\d{2}\.db\.age$/;

function log(msg) {
  console.log(`[backup-db] ${msg}`);
}

// Keep only the newest KEEP files matching `re` in `dir`. `remove` lets the
// caller delete via `git rm` inside the repo instead of a plain unlink.
function prune(dir, re, remove) {
  const files = readdirSync(dir)
    .filter((f) => re.test(f))
    .sort(); // names sort chronologically (ISO dates)
  const old = files.slice(0, Math.max(0, files.length - KEEP));
  for (const f of old) remove(join(dir, f), f);
  if (old.length) log(`pruned ${old.length} old file(s) in ${dir}`);
}

function git(args) {
  return execFileSync("git", ["-C", REPO_DIR, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function main() {
  // --- not bootstrapped yet: succeed quietly ---
  if (!RECIPIENT || !REPO_DIR) {
    log(
      "not configured (need BACKUP_AGE_RECIPIENT + BACKUP_REPO_DIR); " +
        "skipping. See deploy/README.md 'Backups'."
    );
    return;
  }
  if (!existsSync(DB_PATH)) throw new Error(`database not found: ${DB_PATH}`);
  if (!existsSync(join(REPO_DIR, ".git")))
    throw new Error(`BACKUP_REPO_DIR is not a git clone: ${REPO_DIR}`);

  mkdirSync(LOCAL_DIR, { recursive: true });

  const agePath = join(REPO_DIR, `epicentre-${DAY}.db.age`);

  // age output is randomized, so re-encrypting the same DB yields different
  // bytes and an endless string of commits. Capture once per day; a re-run
  // (manual, or a Persistent= catch-up) only ensures the commit is pushed.
  if (existsSync(agePath)) {
    log(`today's backup already present (${agePath}); ensuring it is pushed`);
  } else {
    // --- 1. integrity check ---
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const result = db.pragma("integrity_check");
    const ok = result.length === 1 && result[0].integrity_check === "ok";
    if (!ok) {
      db.close();
      throw new Error(`integrity_check failed: ${JSON.stringify(result)}`);
    }

    // --- 2. consistent copy (online-backup API, WAL-aware) ---
    const plainPath = join(LOCAL_DIR, `epicentre-${DAY}.db`);
    await db.backup(plainPath); // returns a promise
    db.close();
    log(`copied ${DB_PATH} -> ${plainPath} (${statSync(plainPath).size} bytes)`);

    // --- 3. encrypt into the repo worktree ---
    execFileSync(AGE_BIN, ["-r", RECIPIENT, "-o", agePath, plainPath]);
    log(`encrypted -> ${agePath}`);

    // --- 4. keep only the newest KEEP plaintext dailies locally ---
    prune(LOCAL_DIR, NAME_RE, (full) => rmSync(full));
  }

  // --- 5. commit + push. Always runs, so a backup whose push failed last
  //        night (e.g. transient network) is retried tonight. ---
  prune(REPO_DIR, AGE_RE, (full, f) => git(["rm", "--quiet", "--", f]));
  git(["add", "-A"]);
  if (git(["status", "--porcelain"]).trim()) {
    git(["commit", "--quiet", "-m", `backup ${DAY}`]);
  }
  git(["push", "origin", "HEAD"]); // "Everything up-to-date" is a no-op
  log("done");
}

main().catch((err) => {
  console.error(`[backup-db] FAILED: ${err.message}`);
  process.exit(1);
});
