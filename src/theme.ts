// Single source for design tokens (docs/DESIGN_BRIEF.md, "Blaze x Coat x Belly Up").
// src/app/globals.css mirrors these as CSS variables; theme.test.ts keeps the two in sync and checks contrast.

export const colors = {
  light: {
    bg: "#F2F3F5",
    surface: "#FFFFFF",
    text: "#1F242A",
    muted: "#5C646E",
    track: "#E1E4E8",
    coat: "#5E6875",
    "coat-track": "#7D8693",
    "on-coat": "#FFFFFF",
    "on-coat-muted": "#E3E6EA",
    bubble: "#4A535F",
    blaze: "#F7F5F1",
    "on-blaze": "#2F3741",
    tint: "#F1D3CC",
    "on-tint": "#1F242A",
    der: "#2457A8",
    die: "#B83A32",
    das: "#2B7550",
    // Focus ring. The brief says --coat; in dark mode coat is nearly the page colour, so the ring uses --on-coat there.
    focus: "#5E6875",
  },
  dark: {
    bg: "#16191E",
    surface: "#20252B",
    text: "#F2F1EE",
    muted: "#A3ABB5",
    track: "#2E343C",
    coat: "#333B46",
    "coat-track": "#4A5360",
    "on-coat": "#F2F1EE",
    "on-coat-muted": "#C2C8CF",
    bubble: "#454E5B",
    blaze: "#E9E7E2",
    "on-blaze": "#16191E",
    tint: "#43363A",
    "on-tint": "#F2F1EE",
    der: "#8DB4F2",
    die: "#F29A90",
    das: "#7CCB9C",
    focus: "#F2F1EE",
  },
} as const;

export type ColorToken = keyof typeof colors.light;

export const shadows = {
  light: "0 1px 2px rgba(30,40,55,.06), 0 14px 30px -14px rgba(30,40,55,.22)",
  dark: "inset 0 1px 0 rgba(255,255,255,.05), 0 14px 30px -12px rgba(0,0,0,.6)",
} as const;

export const radii = {
  coat: "0 0 40px 72px",
  coatCard: "0 0 28px 56px",
  cushion: "28px",
  field: "16px",
  tabBar: "34px",
} as const;

/** Browser chrome colour: the status bar blends into the coat block. */
export const themeColor = { light: colors.light.coat, dark: colors.dark.coat } as const;

export const theme = {
  gutter: "20px",
  contentMaxWidth: "480px",
  fonts: { sans: "Plus Jakarta Sans" },
} as const;

/** Colour of an article word on a light or dark surface. Words without an article use the muted colour. */
export type Article = "der" | "die" | "das" | "none";
export const articleToken = (article: Article): "der" | "die" | "das" | "muted" => (article === "none" ? "muted" : article);
