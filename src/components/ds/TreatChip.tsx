import { cx } from "./cx";

/** Reward chip, e.g. "+50 treats". Belly-pink is for rewards (and the active tab) only. */
export function TreatChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full bg-tint px-3 py-1 text-[12px] font-bold leading-[1.3] text-on-tint tabular", className)}>
      {children}
    </span>
  );
}
