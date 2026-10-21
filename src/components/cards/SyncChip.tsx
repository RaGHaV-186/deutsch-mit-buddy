"use client";

import { useTranslations } from "next-intl";
import type { SyncUi } from "@/lib/cards/use-deck";

export function SyncChip({ sync, pending, onRetry, pill = false }: { sync: SyncUi; pending: number; onRetry: () => void; pill?: boolean }) {
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
  if (pill) {
    // Desktop focus mode, top-right: a small outlined chip with a status dot.
    const dot = attention ? "bg-die" : sync === "syncing" || sync === "offline" ? "bg-muted" : "bg-das";
    return (
      <p role="status" className="inline-flex items-center gap-2 rounded-full border border-track bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
        {text}
        {sync === "failed" ? (
          <button type="button" onClick={onRetry} className="font-bold text-text underline underline-offset-2">
            {t("retry")}
          </button>
        ) : null}
      </p>
    );
  }
  return (
    <p
      role="status"
      className={`flex flex-wrap items-center justify-center gap-2 text-sm ${attention ? "font-bold text-foreground" : "text-muted"}`}
    >
      <span aria-hidden="true">{sync === "offline" ? "○" : sync === "syncing" ? "…" : attention ? "!" : "✓"}</span>
      {text}
      {sync === "failed" ? (
        <button type="button" onClick={onRetry} className="font-bold text-text underline underline-offset-2">
          {t("retry")}
        </button>
      ) : null}
    </p>
  );
}
