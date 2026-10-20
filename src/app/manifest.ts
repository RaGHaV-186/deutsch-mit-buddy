import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deutsch mit Buddy",
    short_name: "Buddy",
    description: "Learn German from zero to C1 with Buddy, your AI teacher dog.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#fbf9f5",
    theme_color: "#2457C5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/buddy/buddy-happy.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
