import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";

// Deliberately NOT in lib/auth.ts: auth.ts is imported by proxy.ts, which
// runs on the Edge runtime (no Node `crypto` module, no native modules) -
// see auth.ts's own header comment. This file imports getDb() (better-
// sqlite3, Node-only), so it must stay out of anything proxy.ts touches.
// It's only ever used from server actions (app/login, app/settings), which
// run in the Node runtime by default - never from middleware.
//
// scrypt (Node's built-in crypto) rather than bcrypt - avoids a second
// native module alongside better-sqlite3. Stored format is "salt:hash",
// both hex, in app_auth.password_hash (see lib/db.ts for why this table
// exists instead of the original APP_PASSWORD env var).

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  // timingSafeEqual throws if lengths differ rather than returning false -
  // expected.length is always used for both sides above, so they match.
  return timingSafeEqual(actual, expected);
}

function getStoredHash(): string | null {
  const row = getDb()
    .prepare(`SELECT password_hash FROM app_auth WHERE id = 1`)
    .get() as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

export function verifyAppPassword(candidate: string): boolean {
  const stored = getStoredHash();
  if (stored) return verifyHash(candidate, stored);
  // No password has been set via the UI yet - fall back to the original
  // APP_PASSWORD env var so existing logins keep working right up until
  // the first in-app password change.
  const envPassword = process.env.APP_PASSWORD;
  if (!envPassword) return false;
  return candidate === envPassword;
}

// Mutation core (see ARCHITECTURE.md "Actions: mutation core + adapter") -
// app/settings/actions.ts is the thin "use server" wrapper around this.
export function changeAppPassword(
  currentPassword: string,
  newPassword: string
): { ok: true } | { ok: false; error: string } {
  if (!verifyAppPassword(currentPassword)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  const hash = hashPassword(newPassword);
  getDb()
    .prepare(
      `INSERT INTO app_auth (id, password_hash, updated_at) VALUES (1, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`
    )
    .run(hash);
  return { ok: true };
}
