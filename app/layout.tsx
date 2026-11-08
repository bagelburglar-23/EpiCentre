import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { getDeployedSha } from "@/lib/db";
import "./globals.css";

// The accent color is load-bearing for the whole page's appearance, not a
// small streamable widget - block for it rather than wrap a Suspense hole
// around just this piece. See Next.js's blocking-prerender-dynamic docs.
export const instant = false;

async function resolveAccent(): Promise<"red" | "blue" | "grey"> {
  // Production's result never varies per-request, so it's left out of the
  // dynamic path on purpose - this branch stays static, no DB hit needed.
  if (process.env.DEPLOY_ENV !== "preview") return "red";
  const prodSha = await getDeployedSha("production");
  const ownSha = process.env.NEXT_PUBLIC_COMMIT_SHA;
  if (!prodSha || !ownSha || prodSha !== ownSha) return "blue";
  return "grey";
}

// Sans for body text (dense, compact UI), mono for headers/labels/data -
// the "electronic dashboard" feel this is going for.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const isPreview = process.env.DEPLOY_ENV === "preview";
const appName = isPreview ? "EpiCentre UAT" : "EpiCentre";
const icon192 = isPreview ? "/icon-192-uat.png" : "/icon-192.png";
const icon512 = isPreview ? "/icon-512-uat.png" : "/icon-512.png";

export const metadata: Metadata = {
  title: appName,
  description: "Personal ledger and hub",
  appleWebApp: {
    capable: true,
    // Opaque black status bar (white text) sitting ABOVE the web view, rather
    // than black-translucent (which draws the app under the status bar and
    // needs viewport-fit=cover). Paired with dropping cover below, this is the
    // "let iOS inset the web view" approach: the app fills the safe area, the
    // bottom nav lands flush above the home indicator on its own, and there's
    // no edge-to-edge clipping - same model the reference app uses.
    statusBarStyle: "black",
    title: appName,
  },
  icons: {
    icon: [{ url: icon192, sizes: "192x192", type: "image/png" }],
    apple: [{ url: icon192, sizes: "192x192", type: "image/png" }],
    other: [{ rel: "icon", url: icon512, sizes: "512x512", type: "image/png" }],
  },
};

// Mobile viewport: NO viewport-fit=cover. iOS lays the web view inside the safe
// area (below the status bar, above the home indicator), so the bottom nav sits
// flush above the gesture line by itself and there's no edge clipping - the
// approach the reference barber app uses. Zoom is locked so it behaves like a
// native app, not a web page. (Changing viewport-fit only takes effect on a
// fresh Add-to-Home-Screen - iOS caches it at install time.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const accent = await resolveAccent();
  return (
    <html
      lang="en"
      data-accent={accent}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-background text-foreground font-sans text-[14px] leading-snug sm:text-[13px]">
        {/* Apply the saved text-size preference before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('epicentre.prefs')||'{}');var s={small:'15px',normal:'16px',large:'18px'}[p.textSize||'normal'];if(s)document.documentElement.style.fontSize=s}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
