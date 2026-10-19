// Single source for design tokens. globals.css mirrors these as CSS variables.
export const theme = {
  article: {
    der: "#2457C5",
    die: "#C3303A",
    das: "#1E8A4C",
    none: "#6B7280",
  },
  gutter: "16px",
  fonts: {
    body: "Atkinson Hyperlegible",
    heading: "Fraunces",
  },
} as const;

export type Article = keyof typeof theme.article;
