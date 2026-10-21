"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BottomSheet, LogOutIcon, PillButton } from "@/components/ds";
import { SettingsRow } from "@/components/me/SettingsList";
import { SignOutForm } from "@/components/SignOutForm";

/** Log out with a confirmation. The form is the existing SignOutForm, which clears saved pages and cards from this device first. */
export function LogOutRow() {
  const t = useTranslations("Me.logOut");
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow tone="danger" icon={<LogOutIcon size={22} />} label={t("button")} aria-haspopup="dialog" onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("title")}>
        <p className="text-body text-muted">{t("body")}</p>
        <SignOutForm>
          <PillButton type="submit" fullWidth>
            {t("confirm")}
          </PillButton>
        </SignOutForm>
        <PillButton variant="ghost" fullWidth onClick={() => setOpen(false)}>
          {t("cancel")}
        </PillButton>
      </BottomSheet>
    </>
  );
}
