/** Accepts only same-site relative paths, so `?next=` can't become an open redirect. */
export function safeNextPath(value: string | null | undefined, fallback = "/home"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
