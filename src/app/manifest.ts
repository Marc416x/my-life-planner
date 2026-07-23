import type { MetadataRoute } from "next";

// Web app manifest — lets the app be installed to the home screen. On iOS this
// is a hard requirement for Web Push to work at all (Safari only delivers push
// to an installed PWA). Icons currently reuse the favicon; swap in dedicated
// 192/512 PNGs when we have branded artwork.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyLifePlanner — Nursing Academic OS",
    short_name: "MyLifePlanner",
    description:
      "Planner, NCLEX tracker, drug tracker, GPA, and clinical hours for nursing students.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#c17a5b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
