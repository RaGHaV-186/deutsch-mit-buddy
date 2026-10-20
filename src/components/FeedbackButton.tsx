"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { compactButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export function FeedbackButton() {
  const t = useTranslations("Feedback");
  const dialog = useRef<HTMLDialogElement>(null);
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
      <button
        type="button"
        className={`${compactButtonClass} min-h-11 whitespace-nowrap px-3 text-sm`}
        onClick={() => {
          setStatus("idle");
          dialog.current?.showModal();
        }}
      >
        {t("button")}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-xl border border-foreground/30 bg-background p-5 text-foreground backdrop:bg-black/50"
      >
        {status === "sent" ? (
          <div className="flex flex-col gap-4">
            <p role="status">{t("thanks")}</p>
            <button type="button" className={primaryButtonClass} onClick={() => dialog.current?.close()}>
              {t("cancel")}
            </button>
          </div>
        ) : (
          <form action={send} className="flex flex-col gap-4">
            <h2 className="font-heading text-xl font-bold">{t("title")}</h2>
            <label htmlFor="feedback-message" className="font-bold">
              {t("label")}
            </label>
            <textarea
              id="feedback-message"
              name="message"
              required
              maxLength={2000}
              rows={5}
              placeholder={t("placeholder")}
              className={inputClass}
            />
            {status === "error" ? (
              <p role="alert" className="text-die">
                {t("error")}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button type="button" className={secondaryButtonClass} onClick={() => dialog.current?.close()}>
                {t("cancel")}
              </button>
              <button type="submit" className={primaryButtonClass} disabled={status === "sending"}>
                {t("send")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
