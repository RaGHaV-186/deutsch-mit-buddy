import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hardenCookie } from "./cookies";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, hardenCookie(options)),
            );
          } catch {
            // Called from a Server Component; the session refresh happens in proxy.ts.
          }
        },
      },
    },
  );
}
