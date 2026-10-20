// Single source for design tokens. globals.css mirrors these as CSS variables.
export const theme = {
  article: {
    der: "#2457C5",
    die: "#C3303A",
    das: "#1E8A4C",
    none: "#6B7280",
  },
  // Lighter versions of the same colours for dark mode, where the originals are too dark to read as text.
  articleDark: {
    der: "#7DA2F5",
    die: "#F27C85",
    das: "#4DC585",
    none: "#9AA3B2",
  },
  gutter: "16px",
  fonts: {
    body: "Atkinson Hyperlegible",
    heading: "Fraunces",
  },
} as const;

export type Article = keyof typeof theme.article;
