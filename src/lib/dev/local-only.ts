// Safety guard for everything that resets or deletes data (the database tests): it only ever runs against a Supabase on this machine.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True only when `value` is a URL whose host is exactly localhost, 127.0.0.1 or ::1 (a look-alike such as localhost.example.com or 127.0.0.1.nip.io is not). */
export function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Throws unless SUPABASE_URL (the API) points to this machine, and SUPABASE_DB_URL too when it is set. An unset or unreadable URL is refused:
 * "not sure" never counts as local.
 */
export function assertLocalSupabase(env: Record<string, string | undefined>): void {
  if (!isLocalUrl(env.SUPABASE_URL)) {
    throw new Error(`Refusing to run: SUPABASE_URL (${env.SUPABASE_URL ?? "not set"}) is not on this machine. These tests reset and delete data; they only run against the local Supabase (localhost or 127.0.0.1).`);
  }
  if (env.SUPABASE_DB_URL && !isLocalUrl(env.SUPABASE_DB_URL)) {
    throw new Error("Refusing to run: SUPABASE_DB_URL is not on this machine. These tests reset and delete data; they only run against the local database.");
  }
}
