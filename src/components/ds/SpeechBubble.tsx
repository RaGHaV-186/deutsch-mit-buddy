import { cx } from "./cx";

interface Props {
  children: React.ReactNode;
  /** On a white area instead of the coat block. */
  onSurface?: boolean;
  /** Wraps German text in „…“. */
  quoted?: boolean;
  className?: string;
}

/** Buddy's line. `quoted` adds German quotation marks. */
export function SpeechBubble({ children, onSurface = false, quoted = true, className }: Props) {
  return (
    <p
      className={cx(
        "inline-block rounded-[16px_16px_16px_4px] px-4 py-2.5 text-[14px] font-semibold leading-[1.35]",
        onSurface ? "bg-surface text-text shadow-cushion" : "bg-bubble text-on-coat",
        className,
      )}
    >
      {quoted ? <>„{children}“</> : children}
    </p>
  );
}
