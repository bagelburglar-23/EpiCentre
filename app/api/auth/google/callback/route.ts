import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

const REDIRECT_URI = "https://srv1648855.tail523e0b.ts.net/api/auth/google/callback";
// Hardcoded, not built from request.url - behind the Tailscale proxy, Next
// resolved request.url to localhost:3000 (the app's own bind address, not
// the public tailnet hostname), sending the final redirect to a URL that
// can only ever fail in the browser. The outgoing redirect_uri sent TO
// Google (above) was already hardcoded for exactly this reason; this was
// the one spot that still trusted the request to know its own public URL.
const BASE_URL = "https://srv1648855.tail523e0b.ts.net";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(error)}`, BASE_URL)
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?google_error=no_code", BASE_URL));
  }
  try {
    await exchangeCodeForTokens(code, REDIRECT_URI);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(message)}`, BASE_URL)
    );
  }
  return NextResponse.redirect(new URL("/?google_connected=1", BASE_URL));
}
