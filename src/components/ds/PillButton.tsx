import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { SpinnerIcon } from "./icons";

export type PillVariant = "blaze" | "coat" | "cushion" | "outline-on-coat" | "ghost";

const VARIANT: Record<PillVariant, string> = {
  // On the coat block, rings use --on-coat (the page focus colour would vanish against the coat).
  blaze: "bg-blaze text-on-blaze [--ring:var(--on-coat)]",
  // The primary action below the coat block. Coat-coloured in light mode, blaze in dark (where the coat is nearly the page colour).
  coat: "bg-primary text-on-primary",
  cushion: "bg-surface text-text shadow-cushion",
  "outline-on-coat": "border-2 border-on-coat-muted text-on-coat [--ring:var(--on-coat)]",
  ghost: "bg-transparent text-text hover:underline underline-offset-4",
};
const SIZE: Record<44 | 56 | 60, string> = { 44: "min-h-11 h-11", 56: "min-h-14 h-14", 60: "min-h-[60px] h-[60px]" };

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: PillVariant;
  size?: 44 | 56 | 60;
  fullWidth?: boolean;
  /** Spinner + disabled; the button keeps its width. */
  loading?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
  icon?: ReactNode;
  className?: string;
}

/** Fully rounded button. `blaze` sits on the coat block, `coat` below it (coat-coloured in light mode, blaze in dark); `cushion` is secondary. */
export function PillButton({
  variant = "coat",
  size = 56,
  fullWidth = false,
  loading = false,
  href,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const classes = cx(
    "ds-press ds-focus relative inline-flex items-center justify-center gap-2 rounded-full px-6 text-body font-bold",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    fullWidth && "w-full",
    className,
  );
  const content = (
    <>
      <span className={cx("inline-flex items-center justify-center gap-2", loading && "invisible")}>
        {icon}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <SpinnerIcon size={22} />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || loading || undefined} aria-busy={loading || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
