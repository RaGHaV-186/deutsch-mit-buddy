import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/AuthForms";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const t = await getTranslations("SignUp");
  const b = await getTranslations("Buddy");
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("signup_open");
  // Full: Google and password sign-ups would both be refused by the database, so offer the waitlist instead.
  if (open === false) redirect("/waitlist?full=1");
  return (
    <AuthLayout title={t("title")} line={b("letsStart.de")} helper={b("letsStart.en")} intro={t("subtitle")} formTitle={t("submit")} pose="talking">
      <SignUpForm googleEnabled />
    </AuthLayout>
  );
}
