import { colors, themeColor } from "@/theme";

// One place for the installable-app facts (docs/DESIGN_BRIEF.md, Phase 3). The manifest and the root layout read these,
// and pwa.test.ts checks that every file named here exists and has the size it claims.

export const PWA = {
  name: "Deutsch mit Buddy",
  shortName: "Buddy",
  startUrl: "/home",
  themeColor: themeColor.light, // the status bar blends into the coat block
  backgroundColor: colors.light.bg,
  icons: [
    { src: "/buddy/buddy-icon-light-192.png", sizes: "192x192", type: "image/png" },
    { src: "/buddy/buddy-icon-light-512.png", sizes: "512x512", type: "image/png" },
    // Buddy's head and ears sit inside the central 80% circle (checked in pwa.test.ts), so the same artwork works masked.
    { src: "/buddy/buddy-icon-light-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  appleTouchIcon: "/buddy/buddy-icon-light-180.png",
  // A copy of the glyph that switches its ink to #F2F1EE in dark browser themes (the original glyph is untouched).
  favicon: "/buddy/buddy-glyph-favicon.svg",
} as const;
