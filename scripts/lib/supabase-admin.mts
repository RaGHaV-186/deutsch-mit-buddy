import { createClient } from "@supabase/supabase-js";

/** Service-role client for the maintenance scripts. Run them with `node --env-file=.env.local`. */
export function adminClient(argv: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use --env-file=.env.local).");
  const host = new URL(url).host;
  const local = /^(127\.0\.0\.1|localhost)(:|$)/.test(host);
  console.log(`Database: ${host}${local ? " (local)" : " (REMOTE)"}`);
  // Writing to a hosted project needs an explicit --yes, so a stale .env.local can't be used by accident.
  if (!local && !argv.includes("--yes")) throw new Error(`${host} is not a local database. Re-run with --yes to write to it.`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function upsertInBatches(
  db: ReturnType<typeof adminClient>,
  table: string,
  rows: readonly object[],
  onConflict: string,
  size = 200,
) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
