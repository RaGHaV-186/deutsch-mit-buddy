import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { ChevronDownIcon } from "./icons";

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: string;
  children: ReactNode;
}

/** Labelled 56px native select, styled like TextField. */
export function SelectField({ label, id, children, ...select }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-label normal-case tracking-normal text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={fieldId}
          className="ds-focus h-14 w-full appearance-none rounded-field bg-surface pl-4 pr-12 text-[16px] font-medium text-text shadow-[inset_0_0_0_1px_var(--track)] focus-visible:outline-2 focus-visible:outline-offset-2"
          {...select}
        >
          {children}
        </select>
        <ChevronDownIcon size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
