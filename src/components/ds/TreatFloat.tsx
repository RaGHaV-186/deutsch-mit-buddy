import { TreatChip } from "./TreatChip";

/** "+10" chip that floats up and fades out in about half a second. Re-key it to replay (game layer only). */
export function TreatFloat({ children }: { children: React.ReactNode }) {
  return (
    <span className="ds-float-up pointer-events-none absolute left-1/2 top-0 -translate-x-1/2" role="status">
      <TreatChip>{children}</TreatChip>
    </span>
  );
}
