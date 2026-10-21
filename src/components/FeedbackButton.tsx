"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BottomSheet, ChatIcon, PillButton, TextAreaField } from "@/components/ds";
import { SettingsRow } from "@/components/me/SettingsList";

/** The "Send feedback" row on Me; opens a sheet with a message box. Posts to /api/feedback. */
export function FeedbackButton() {
  const t = useTranslations("Feedback");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(formData: FormData) {
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: formData.get("message") }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <SettingsRow
        icon={<ChatIcon size={22} />}
        label={t("button")}
        aria-haspopup="dialog"
        onClick={() => {
          setStatus("idle");
          setOpen(true);
        }}
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("title")}>
        {status === "sent" ? (
          <>
            <p role="status" className="text-body">
              {t("thanks")}
            </p>
            <PillButton fullWidth onClick={() => setOpen(false)}>
              {t("close")}
            </PillButton>
          </>
        ) : (
          <form action={send} className="flex flex-col gap-4">
            <TextAreaField label={t("label")} name="message" required maxLength={2000} placeholder={t("placeholder")} />
            {status === "error" ? (
              <p role="alert" className="text-caption text-die">
                {t("error")}
              </p>
            ) : null}
            <PillButton type="submit" fullWidth loading={status === "sending"}>
              {t("send")}
            </PillButton>
          </form>
        )}
      </BottomSheet>
    </>
  );
}
