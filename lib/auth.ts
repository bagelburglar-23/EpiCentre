import { SignJWT, jwtVerify } from "jose";

// jose, not Node's crypto - middleware runs on the Edge runtime, where
// Node's crypto module isn't available (see ARCHITECTURE.md "Auth").
// One password, one cookie, no user table (D-11) - a token here is just
// "authenticated: yes/no", nothing per-user to encode.

export const SESSION_COOKIE_NAME = "epicentre_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

// Pure function, takes the raw cookie VALUE rather than reading the cookie
// itself - middleware (NextRequest.cookies) and server components/actions
// (next/headers cookies()) have different APIs for getting that value, but
// identical verification logic once they have it. Each caller extracts the
// cookie with whichever API fits its own context and passes the string in.
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false; // expired, tampered, or wrong secret - all just "not authenticated"
  }
}

// Password checking/changing lives in lib/account.ts, not here - it needs
// getDb() (better-sqlite3), which this file must stay free of since
// proxy.ts imports it on the Edge runtime. See lib/account.ts's header.
