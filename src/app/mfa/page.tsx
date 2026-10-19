import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

// Dispatcher: decides between 2FA setup (no authenticator yet) and 2FA check (has one).
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await requireSession();
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  if (state.status === "aal2") redirect(next || "/home");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const target = (data?.totp?.length ?? 0) > 0 ? "/mfa/verify" : "/mfa/setup";
  redirect(next ? `${target}?next=${encodeURIComponent(next)}` : target);
}
