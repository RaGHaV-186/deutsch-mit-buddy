"use client";

import { useTranslations } from "next-intl";
import type { SyncUi } from "@/lib/cards/use-deck";

export function SyncChip({ sync, pending, onRetry }: { sync: SyncUi; pending: number; onRetry: () => void }) {
  const t = useTranslations("Cards.sync");
  let text: string;
  switch (sync) {
    case "syncing":
      text = t("syncing");
      break;
    case "offline":
      text = pending > 0 ? t("offlineWaiting", { count: pending }) : t("offline");
      break;
    case "failed":
      text = t("failed");
      break;
    case "signed-out":
      text = t("signedOut");
      break;
    default:
      text = pending > 0 ? t("waiting", { count: pending }) : t("synced");
  }
  const attention = sync === "failed" || sync === "signed-out" || (sync === "offline" && pending > 0);
  return (
    <p
      role="status"
      className={`flex flex-wrap items-center justify-center gap-2 text-sm ${attention ? "font-bold text-foreground" : "text-muted"}`}
    >
      <span aria-hidden="true">{sync === "offline" ? "○" : sync === "syncing" ? "…" : attention ? "!" : "✓"}</span>
      {text}
      {sync === "failed" ? (
        <button type="button" onClick={onRetry} className="font-bold text-der underline underline-offset-2 dark:text-sky-300">
          {t("retry")}
        </button>
      ) : null}
    </p>
  );
}
