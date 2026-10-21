"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppChrome } from "./app-chrome";
import { cx } from "./cx";
import { BookIcon, CardsIcon, GameIcon, HomeIcon } from "./icons";
import type { TabId } from "./FloatingTabBar";

const ITEMS: { id: Exclude<TabId, "me">; href: string; Icon: typeof HomeIcon }[] = [
  { id: "home", href: "/home", Icon: HomeIcon },
  { id: "learn", href: "/learn", Icon: BookIcon },
  { id: "cards", href: "/cards", Icon: CardsIcon },
  { id: "play", href: "/play", Icon: GameIcon },
];

/**
 * Desktop navigation (1024px and up), replacing the floating tab bar: app icon and name, four 48px rows (the active one on a
 * belly-pink pill, Cards with its due badge), and Me with the learner's initial pinned to the bottom.
 */
export function Sidebar({ active }: { active: TabId }) {
  const t = useTranslations("Ds.nav");
  const meta = useTranslations("Meta");
  const { initial, due } = useAppChrome();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-track bg-surface desk:flex">
      <div className="flex items-center gap-2.5 px-6 pb-3 pt-7">
        <Image src="/buddy/buddy-icon-light.svg" alt="" width={32} height={32} className="rounded-lg" unoptimized />
        <span className="text-[15px] font-bold leading-tight">{meta("title")}</span>
      </div>
      <nav aria-label={t("label")} className="flex flex-1 flex-col gap-1.5 px-4 pt-4">
        {ITEMS.map(({ id, href, Icon }) => {
          const isActive = id === active;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "ds-focus flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold",
                isActive ? "bg-tint text-on-tint" : "text-muted hover:bg-bg",
              )}
            >
              <Icon size={22} />
              <span className="flex-1">{t(id)}</span>
              {id === "cards" && due > 0 ? (
                <span className="rounded-full bg-track px-2 py-0.5 text-[12px] font-bold text-text tabular">
                  <span aria-hidden="true">{due}</span>
                  <span className="sr-only">{t("due", { count: due })}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 pb-7">
        <Link
          href="/me"
          aria-current={active === "me" ? "page" : undefined}
          className={cx(
            "ds-focus flex h-14 items-center gap-3 rounded-full border border-track px-3 text-[15px] font-bold",
            active === "me" ? "bg-tint text-on-tint" : "bg-surface hover:bg-bg",
          )}
        >
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-coat text-[14px] font-bold text-on-coat">
            {initial || "·"}
          </span>
          <span className="flex-1">{t("me")}</span>
          <span className="text-[13px] font-medium text-muted">{t("settings")}</span>
        </Link>
      </div>
    </aside>
  );
}
