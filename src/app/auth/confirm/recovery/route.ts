import type { NextRequest } from "next/server";
import { handleEmailLink } from "@/lib/auth/email-link";

// Password-reset links. The code/token gives a session, then the member chooses a new password.
export async function GET(request: NextRequest) {
  return handleEmailLink(request, "/reset-password");
}
