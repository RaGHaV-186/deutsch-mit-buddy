import type { CookieOptions } from "@supabase/ssr";

/** Sessions end after 7 days without a visit: the cookie is re-issued whenever the 1 h token refreshes. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** All Supabase auth cookies are set by the server only, so they can be HTTP-only. */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.min(options.maxAge ?? SESSION_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS),
  };
}
