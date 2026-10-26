import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token);
  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// Excludes: the login page itself (or this would redirect-loop), Next's
// static assets, and the PWA manifest/icons (so they keep loading for the
// install prompt even when logged out - none of this is sensitive content,
// no reason to gate it).
export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon-.*\\.png).*)",
  ],
};
