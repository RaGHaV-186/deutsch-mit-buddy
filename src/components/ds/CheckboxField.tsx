import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  /** The text beside the box. May contain links; the box is named by it. */
  children: ReactNode;
}

/** A native checkbox (so `required` and form submission keep working) with a 44px tap area and the text beside it. */
export function CheckboxField({ children, id, ...input }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  const textId = `${fieldId}-text`;
  return (
    <div className="flex items-start gap-1">
      {/* The empty label only enlarges the tap target; the accessible name comes from the text. */}
      <label htmlFor={fieldId} className="flex min-h-11 w-11 shrink-0 items-start justify-center pt-2.5">
        <input id={fieldId} type="checkbox" aria-labelledby={textId} className="ds-focus size-6 cursor-pointer accent-primary" {...input} />
      </label>
      <div id={textId} className="min-h-11 flex-1 pt-2.5 text-body">
        {children}
      </div>
    </div>
  );
}
