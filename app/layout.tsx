import type { Metadata } from "next";
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
    statusBarStyle: "black-translucent",
    title: appName,
  },
  icons: {
    icon: [{ url: icon192, sizes: "192x192", type: "image/png" }],
    apple: [{ url: icon192, sizes: "192x192", type: "image/png" }],
    other: [{ rel: "icon", url: icon512, sizes: "512x512", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const accent = await resolveAccent();
  return (
    <html
      lang="en"
      data-accent={accent}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans text-[13px] leading-snug">
        {children}
      </body>
    </html>
  );
}
