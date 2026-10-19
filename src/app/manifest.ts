import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deutsch mit Buddy",
    short_name: "Buddy",
    description: "Learn German from zero to C1 with Buddy, your AI teacher dog.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf9f5",
    theme_color: "#2457C5",
    icons: [
      { src: "/buddy/buddy-happy.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
