import type { NextRequest } from "next/server";
import { handleEmailLink } from "@/lib/auth/email-link";

// Sign-up confirmation links. Next stop: /mfa (set up or check two-factor).
export async function GET(request: NextRequest) {
  return handleEmailLink(request, "/mfa");
}
