import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { snapshotRequestSchema } from "@/lib/cards/schema";
import { getSnapshot } from "@/lib/cards/server";
import { safeTimeZone } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

/** The cards a phone needs to review offline. Read with the member's own session, so row-level security applies. */
export const POST = withAuth(
  { name: "cards-snapshot", limit: 30, windowSeconds: 600, schema: snapshotRequestSchema },
  async ({ userId }) => {
    try {
      const supabase = await createClient();
      const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
      const snapshot = await getSnapshot(supabase, userId, new Date(), safeTimeZone(profile?.timezone));
      return NextResponse.json(snapshot);
    } catch (err) {
      console.error("cards snapshot failed", { message: (err as Error).message });
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
  },
);
