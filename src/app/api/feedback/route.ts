import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { feedbackSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export const POST = withAuth(
  { name: "feedback", limit: 5, windowSeconds: 3600, schema: feedbackSchema },
  async ({ userId, input }) => {
    const supabase = await createClient();
    const { error } = await supabase.from("feedback").insert({ user_id: userId, message: input.message });
    if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  },
);
