import type { Ref, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "./cx";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label: string;
  hint?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Labelled multi-line input, styled like TextField (16px text so iOS doesn't zoom in). */
export function TextAreaField({ label, hint, id, ref, rows = 5, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-label normal-case tracking-normal text-text">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className={cx(
          "w-full resize-none rounded-field bg-bg p-4 text-[16px] font-medium text-text placeholder:text-muted",
          "ds-focus shadow-[inset_0_0_0_1px_var(--track)] focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
        {...rest}
      />
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
