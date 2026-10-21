import { PawIcon } from "./icons";
import { cx } from "./cx";

interface Props {
  /** 0 to 1. */
  value: number;
  /** 12 to 14 px. */
  height?: number;
  /** On the coat block: light fill on the lighter coat track. */
  onCoat?: boolean;
  /** A paw at the end of the fill. */
  marker?: boolean;
  /** Fill colour on the page. "die" and "das" are for meters such as password strength; default is --progress. */
  tone?: "progress" | "die" | "das";
  label: string;
  className?: string;
}

/** Progress as a wedge: thin on the left, full height on the right. */
export function WedgeProgress({ value, height = 12, onCoat = false, marker = false, tone = "progress", label, className }: Props) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(v * 100);
  const markerSize = height + 12;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cx("relative", className)}
      style={{ height }}
    >
      <div
        className={cx("absolute inset-0 overflow-hidden", onCoat ? "bg-coat-track" : "bg-track")}
        style={{ clipPath: "polygon(0 36%, 100% 0, 100% 100%, 0 64%)" }}
      >
        <div className={cx("h-full", onCoat ? "bg-on-coat" : tone === "die" ? "bg-die" : tone === "das" ? "bg-das" : "bg-progress")} style={{ width: `${v * 100}%` }} />
      </div>
      {marker ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 flex items-center justify-center rounded-full bg-surface text-progress shadow-cushion"
          style={{ left: `${v * 100}%`, width: markerSize, height: markerSize, transform: "translate(-50%, -50%)" }}
        >
          <PawIcon size={Math.round(markerSize * 0.6)} />
        </span>
      ) : null}
    </div>
  );
}
