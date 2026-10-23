import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

/**
 * The auth server says, for certain, that this token no longer belongs to a session: the user was deleted, the session was revoked,
 * or the token is not accepted. (A network error or a 5xx from the auth server says nothing about the session and must not sign anyone out.)
 */
export function isDefinitivelySignedOut(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && [401, 403, 404].includes(error.status);
}

/** Where a screen that found the session unusable sends the browser: clearing the cookies first, since /login sends anyone with a valid-looking token back into the app. */
export const STALE_SESSION_PATH = "/auth/stale";
