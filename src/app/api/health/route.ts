import { NextResponse } from "next/server";

// Public liveness check. Reports whether Supabase answers; never returns keys or errors in detail.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ app: "ok", supabase: "not-configured" });
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return NextResponse.json({
      app: "ok",
      supabase: res.ok ? "ok" : "unreachable",
    });
  } catch {
    return NextResponse.json({ app: "ok", supabase: "unreachable" });
  }
}
