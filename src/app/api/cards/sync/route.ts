import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { syncRequestSchema } from "@/lib/cards/schema";
import { applyReviews } from "@/lib/cards/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accepts answers given on a device (possibly offline) and returns the authoritative schedules.
 * Written with the service role (members cannot write the schedule), always scoped to the verified user.
 */
export const POST = withAuth(
  { name: "cards-sync", limit: 60, windowSeconds: 600, schema: syncRequestSchema },
  async ({ userId, input }) => {
    try {
      const result = await applyReviews(createAdminClient(), userId, input.reviews, new Date());
      return NextResponse.json(result);
    } catch (err) {
      console.error("cards sync failed", { message: (err as Error).message });
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
  },
);
