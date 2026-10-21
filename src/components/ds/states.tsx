"use client";

import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { BuddyMascot, type BuddyPose } from "./BuddyMascot";
import { Cushion } from "./Cushion";
import { cx } from "./cx";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";
import { PillButton } from "./PillButton";

/** A rounded placeholder block shown while content loads. Give `label` once per group so screen readers hear "Loading". */
export function Skeleton({ width = "100%", height = 16, radius = 12, label, className, onCoat = false }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  label?: string;
  className?: string;
  /** On the coat block: the lighter coat track colour instead of the page one. */
  onCoat?: boolean;
}) {
  const t = useTranslations("Ds.states");
  return (
    <div
      className={cx("animate-pulse", onCoat ? "bg-coat-track" : "bg-track", className)}
      style={{ width, height, borderRadius: radius }}
      {...(label !== undefined ? { role: "status", "aria-label": label || t("loading") } : { "aria-hidden": true })}
    />
  );
}

interface EmptyProps {
  message: string;
  pose?: BuddyPose;
  action?: { label: string; href?: string; onClick?: () => void };
}

/** Buddy, one line, one button. */
export function EmptyState({ message, pose = "neutral", action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <BuddyMascot pose={pose} size={96} />
      <p className="max-w-[28ch] text-[16px] font-semibold">{message}</p>
      {action ? (
        <PillButton variant="cushion" href={action.href} onClick={action.onClick}>
          {action.label}
        </PillButton>
      ) : null}
    </div>
  );
}

/** Something failed: a puzzled Buddy, what happened, and Retry. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations("Ds.states");
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <BuddyMascot pose="curious" size={96} />
      <p className="max-w-[28ch] text-[16px] font-semibold">{message ?? t("error")}</p>
      {onRetry ? (
        <PillButton variant="cushion" onClick={onRetry}>
          {t("retry")}
        </PillButton>
      ) : null}
    </div>
  );
}

const TOAST_ICON = { success: CheckIcon, error: AlertIcon, info: InfoIcon } as const;
const TOAST_COLOR = { success: "text-das", error: "text-die", info: "text-muted" } as const;

interface ToastProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  kind?: keyof typeof TOAST_ICON;
  /** Milliseconds until it dismisses itself. */
  duration?: number;
}

/** A pill at the top of the screen. Dismisses itself after 3 seconds. */
export function Toast({ open, onClose, children, kind = "success", duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [open, onClose, duration]);

  if (!open) return null;
  const Icon = TOAST_ICON[kind];
  return (
    <div
      className="ds-toast pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4"
      style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top) + 8px))" }}
    >
      <Cushion radius={999} className="pointer-events-auto flex items-center gap-2 px-4 py-3 text-[14px] font-semibold">
        <span role={kind === "error" ? "alert" : "status"} className="flex items-center gap-2">
          <Icon size={20} className={TOAST_COLOR[kind]} />
          {children}
        </span>
      </Cushion>
    </div>
  );
}
