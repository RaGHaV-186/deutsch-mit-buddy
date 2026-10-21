import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon, Cushion } from "@/components/ds";
import { cx } from "@/components/ds/cx";

/** A grouped list of settings rows on one Cushion, separated by thin rules (docs/DESIGN_BRIEF.md, Me). */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-label text-muted">{title}</h2>
      <Cushion className="overflow-hidden">
        <ul className="divide-y divide-track">{children}</ul>
      </Cushion>
    </section>
  );
}

const ROW = "ds-focus flex h-14 w-full items-center gap-3 px-4 text-left text-body font-bold active:bg-bg";

interface RowProps {
  icon: ReactNode;
  label: string;
  /** "danger" is for log out: --die text and no chevron. */
  tone?: "default" | "danger";
}

/** A 56px row. With `href` it is a link, with `onClick` a button. */
export function SettingsRow({ icon, label, tone = "default", href, onClick, ...aria }: RowProps & { href?: string; onClick?: () => void; "aria-haspopup"?: "dialog" }) {
  const inner = (
    <>
      <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center", tone === "danger" ? "text-die" : "text-muted")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {tone === "danger" ? null : <ChevronRightIcon size={20} className="text-muted" />}
    </>
  );
  const classes = cx(ROW, tone === "danger" && "text-die");
  return (
    <li>
      {href ? (
        <Link href={href} className={classes}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classes} {...aria}>
          {inner}
        </button>
      )}
    </li>
  );
}
