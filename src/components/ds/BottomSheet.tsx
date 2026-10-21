"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { cx } from "./cx";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A sheet that slides up from the bottom (options, filters). A modal dialog: Escape and a tap on the dim area close it,
 * focus moves into it when it opens and returns to the button that opened it when it closes.
 */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const t = useTranslations("Ds");
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center desk:items-center">
      <button type="button" aria-label={t("sheetClose")} tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "ds-sheet relative flex w-full max-w-[480px] tab:max-w-[560px] flex-col gap-5 rounded-t-[32px] desk:rounded-[32px] bg-surface p-5 text-text shadow-cushion outline-none",
        )}
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-headline">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-full bg-bg"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
