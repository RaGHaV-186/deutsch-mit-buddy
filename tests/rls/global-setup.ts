import { execSync } from "node:child_process";

// Reads the local stack's URL and keys from `supabase status` unless they are already set (CI can export them).
export default function setup() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  let out: string;
  try {
    out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run db:start`, then re-run `npm run test:rls`.");
  }
  const vars: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) vars[m[1]] = m[2];
  }
  process.env.SUPABASE_URL ??= vars.API_URL;
  process.env.SUPABASE_ANON_KEY ??= vars.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= vars.SERVICE_ROLE_KEY;
  process.env.SUPABASE_DB_URL ??= vars.DB_URL;
}
