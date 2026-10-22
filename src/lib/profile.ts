import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  user_id: string;
  display_name: string | null;
  role: "member" | "admin";
  start_code: string | null;
  session_seq: number;
  day_count: number;
  onboarded_at: string | null;
  terms_accepted_at: string | null;
  timezone: string | null;
  /** Highest published lesson (curriculum index) whose cards were copied into the deck; null before the first unlock. */
  deck_unlocked_seq: number | null;
}

/** The signed-in member's own profile (row-level security returns nothing below two-factor). */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, role, start_code, session_seq, day_count, onboarded_at, terms_accepted_at, timezone, deck_unlocked_seq")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});
