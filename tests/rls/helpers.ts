import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { totp } from "./totp";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbUrl = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const PASSWORD = "correct-horse-battery-staple";

// These tests delete every user, so they must never run against a hosted project.
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url ?? "")) {
  throw new Error(`Refusing to run RLS tests against non-local Supabase URL: ${url}`);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export const admin = createClient(url, serviceKey, opts);
export const anon = () => createClient(url, anonKey, opts);

export const uniqueEmail = () => `rls-${randomUUID()}@example.test`;

export interface TestUser {
  id: string;
  email: string;
  /** Password + verified TOTP: AAL2. */
  aal2: SupabaseClient;
  /** Password only, with a verified factor on the account: AAL1. */
  aal1: SupabaseClient;
}

export async function createUserRaw(email = uniqueEmail(), confirm = true) {
  return admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: confirm });
}

/** Creates a confirmed user with a verified authenticator and returns AAL1 and AAL2 clients. */
export async function createMember(): Promise<TestUser> {
  const email = uniqueEmail();
  const { data, error } = await createUserRaw(email);
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const aal2 = anon();
  const signIn = await aal2.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  const enroll = await aal2.auth.mfa.enroll({ factorType: "totp", friendlyName: "test" });
  if (enroll.error) throw enroll.error;
  const verify = await aal2.auth.mfa.challengeAndVerify({
    factorId: enroll.data.id,
    code: totp(enroll.data.totp.secret),
  });
  if (verify.error) throw verify.error;

  const aal1 = anon();
  const second = await aal1.auth.signInWithPassword({ email, password: PASSWORD });
  if (second.error) throw second.error;

  return { id: data.user.id, email, aal2, aal1 };
}

export async function purgeUsers() {
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) return;
    await Promise.all(data.users.map((u) => admin.auth.admin.deleteUser(u.id)));
  }
}

export async function setMemberCap(cap: number) {
  const { error } = await admin.from("app_config").update({ value: cap }).eq("key", "member_cap");
  if (error) throw error;
}

/** Direct SQL as the postgres role, for things the API can't do (e.g. backdating created_at). */
export async function sql<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function resetState() {
  await purgeUsers();
  await admin.from("waitlist").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("rate_limits").delete().neq("key", "");
  await setMemberCap(30);
}
