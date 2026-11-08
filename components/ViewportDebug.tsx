"use client";

import { useEffect, useState } from "react";

// TEMPORARY diagnostic (remove after the nav-gap fix is confirmed). Renders a
// bright bar pinned to `bottom: 0` so we can see where the CSS viewport bottom
// actually lands relative to the physical screen + home indicator, and prints
// the key height metrics iOS reports in this standalone PWA. The bar's own
// bottom edge vs the screen edge is the real signal.
export default function ViewportDebug() {
  const [info, setInfo] = useState("measuring…");

  useEffect(() => {
    function probe(css: string): number {
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;visibility:hidden;width:1px;height:${css}`;
      document.body.appendChild(el);
      const h = el.getBoundingClientRect().height;
      el.remove();
      return Math.round(h);
    }
    function measure() {
      const sa =
        typeof navigator !== "undefined" &&
        (("standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone) ||
          window.matchMedia("(display-mode: standalone)").matches);
      // Where does the mobile bottom nav actually sit? (it has class "fixed")
      const nav = document.querySelector("nav.fixed") as HTMLElement | null;
      const r = nav?.getBoundingClientRect();
      const navStr = r
        ? `navTop ${Math.round(r.top)} navBot ${Math.round(r.bottom)} navH ${Math.round(r.height)}`
        : "nav ?";
      setInfo(
        [
          `inner ${window.innerHeight}`,
          `screen ${screen.width}x${screen.height}`,
          navStr,
          `dvh ${probe("100dvh")}`,
          `svh ${probe("100svh")}`,
          `lvh ${probe("100lvh")}`,
          `saTop ${probe("env(safe-area-inset-top)")}`,
          `saBot ${probe("env(safe-area-inset-bottom)")}`,
          `dpr ${window.devicePixelRatio}`,
          `standalone ${sa}`,
        ].join(" · ")
      );
    }
    measure();
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: "rgba(220,20,20,0.92)",
        color: "#fff",
        font: "10px/1.35 monospace",
        padding: "3px 6px",
        pointerEvents: "none",
        wordBreak: "break-word",
      }}
    >
      ▼ bottom:0 lands here · {info}
    </div>
  );
}
