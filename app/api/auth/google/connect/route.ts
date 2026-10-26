import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

// A genuine exception to D-13 ("server actions, not API routes") - OAuth
// providers redirect the browser to a URL, which can only be a route
// handler, not a server action (which requires React's own fetch protocol,
// not a plain browser navigation). See ARCHITECTURE.md's D-13 scope note
// for the other sanctioned exception (the future agent route) - this is
// the same kind of carve-out, not a crack in the rule.
const REDIRECT_URI = "https://srv1648855.tail523e0b.ts.net/api/auth/google/callback";

export async function GET() {
  return NextResponse.redirect(getAuthUrl(REDIRECT_URI));
}
