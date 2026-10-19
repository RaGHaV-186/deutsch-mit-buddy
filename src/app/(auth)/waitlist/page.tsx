import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WaitlistForm } from "@/components/AuthForms";
import { AuthShell, linkClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function WaitlistPage() {
  const t = await getTranslations("Waitlist");
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("signup_open");
  return (
    <AuthShell title={t("title")} subtitle={t("intro")}>
      {open ? (
        <p>
          {t("open")}{" "}
          <Link href="/signup" className={linkClass}>
            {t("toSignUp")}
          </Link>
        </p>
      ) : null}
      <WaitlistForm />
    </AuthShell>
  );
}
