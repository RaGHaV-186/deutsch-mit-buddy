import type { MetadataRoute } from "next";
import { PWA } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA.name,
    short_name: PWA.shortName,
    description: "Learn German from zero to C1 with Buddy, your AI teacher dog.",
    start_url: PWA.startUrl,
    scope: "/",
    display: "standalone",
    background_color: PWA.backgroundColor,
    theme_color: PWA.themeColor,
    icons: PWA.icons.map((icon) => ({ ...icon })),
  };
}
