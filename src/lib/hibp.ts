import { createHash } from "node:crypto";

/**
 * Checks a password against Have I Been Pwned's range API (k-anonymity: only the first 5 hash characters
 * leave the server). Supabase's own leaked-password check is Pro-only. Fails open if the API is unreachable.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
