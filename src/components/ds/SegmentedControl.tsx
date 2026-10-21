import { cx } from "./cx";

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  text: (value: T) => string;
}

/** A row of mutually exclusive choices (a radio group). The chosen one is filled with --progress, which reads in light and dark. */
export function SegmentedControl<T extends string>({ label, value, options, onChange, text }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <p className="text-label normal-case tracking-normal">{label}</p>
      <div className="flex gap-1 rounded-full bg-bg p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            onClick={() => onChange(option)}
            className={cx(
              "ds-focus min-h-11 flex-1 rounded-full px-3 text-[14px] font-bold",
              option === value ? "bg-progress text-on-progress" : "text-text hover:bg-surface",
            )}
          >
            {text(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
