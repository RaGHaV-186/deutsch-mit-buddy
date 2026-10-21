import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { useId } from "react";
import { AlertIcon } from "./icons";
import { cx } from "./cx";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** Shown below, in the error colour with an icon. Also sets aria-invalid. */
  error?: string;
  /** Helper text in muted caption style (e.g. an English hint under a German label). */
  hint?: string;
  /** A 44px control inside the field, e.g. show/hide password. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** Labelled 56px input. Font size is 16px so iOS doesn't zoom in. */
export function TextField({ label, error, hint, trailing, id, ref, ...input }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  const messageId = `${fieldId}-message`;
  const hasMessage = Boolean(error || hint);
  return (
    <div className="flex flex-col gap-1.5 desk:gap-2">
      <label htmlFor={fieldId} className="text-label normal-case tracking-normal text-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cx(
            "h-14 w-full rounded-field bg-surface px-4 text-[16px] font-medium text-text placeholder:text-muted",
            "ds-focus focus-visible:outline-2 focus-visible:outline-offset-2",
            error ? "shadow-[inset_0_0_0_2px_var(--die)]" : "shadow-[inset_0_0_0_1px_var(--track)]",
            "disabled:opacity-60",
            Boolean(trailing) && "pr-14",
          )}
          {...input}
        />
        {trailing ? <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div> : null}
      </div>
      {hasMessage ? (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cx("flex items-start gap-1.5 text-caption", error ? "text-die" : "text-muted")}
        >
          {error ? <AlertIcon size={16} className="mt-0.5 shrink-0" /> : null}
          <span>{error ?? hint}</span>
        </p>
      ) : null}
    </div>
  );
}
