import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { WaitlistForm } from "@/components/AuthForms";
import { linkClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function WaitlistPage() {
  const t = await getTranslations("Waitlist");
  const b = await getTranslations("Buddy");
  const d = await getTranslations("Desktop");
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("signup_open");
  return (
    <AuthLayout formTitle={d("heading.waitlist")} title={t("title")} line={b("soonYourTurn.de")} helper={b("soonYourTurn.en")} intro={t("intro")} pose="resting">
      {open ? (
        <p>
          {t("open")}{" "}
          <Link href="/signup" className={`${linkClass} inline-flex min-h-11 items-center`}>
            {t("toSignUp")}
          </Link>
        </p>
      ) : null}
      <WaitlistForm />
    </AuthLayout>
  );
}
