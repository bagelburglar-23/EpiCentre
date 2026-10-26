import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

const REDIRECT_URI = "https://srv1648855.tail523e0b.ts.net/api/auth/google/callback";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(error)}`, request.url)
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?google_error=no_code", request.url));
  }
  try {
    await exchangeCodeForTokens(code, REDIRECT_URI);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(message)}`, request.url)
    );
  }
  return NextResponse.redirect(new URL("/?google_connected=1", request.url));
}
