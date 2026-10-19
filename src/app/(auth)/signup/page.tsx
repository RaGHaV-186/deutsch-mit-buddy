import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const t = await getTranslations("SignUp");
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("signup_open");
  // Full: Google and password sign-ups would both be refused by the database, so offer the waitlist instead.
  if (open === false) redirect("/waitlist?full=1");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <SignUpForm googleEnabled />
    </AuthShell>
  );
}
