import type { MetadataRoute } from "next";

// Prod and preview are different origins (different port - :8443 for UAT),
// so each installs as its own separate PWA with its own icon and name -
// that's what makes two distinct home-screen apps possible from one
// codebase, no extra infrastructure needed.
export default function manifest(): MetadataRoute.Manifest {
  const isPreview = process.env.DEPLOY_ENV === "preview";
  return {
    name: isPreview ? "EpiCentre UAT" : "EpiCentre",
    short_name: isPreview ? "EpiCentre UAT" : "EpiCentre",
    description: "Personal ledger and hub",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: isPreview ? "/icon-192-uat.png" : "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: isPreview ? "/icon-512-uat.png" : "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
