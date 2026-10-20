import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "./cx";
import { BookIcon, CardsIcon, GameIcon, HomeIcon, UserIcon } from "./icons";

export type TabId = "home" | "learn" | "cards" | "play" | "me";

const TABS: { id: TabId; href: string; Icon: typeof HomeIcon }[] = [
  { id: "home", href: "/home", Icon: HomeIcon },
  { id: "learn", href: "/learn", Icon: BookIcon },
  { id: "cards", href: "/cards", Icon: CardsIcon },
  { id: "play", href: "/play", Icon: GameIcon },
  { id: "me", href: "/me", Icon: UserIcon },
];

interface Props {
  active: TabId;
  /** Small dot on a tab, e.g. something new to play. */
  badges?: Partial<Record<TabId, boolean>>;
  /** "fixed" sits at the bottom of the screen (default); "static" is for showcases. */
  position?: "fixed" | "static";
}

/** Detached pill with the five tabs. The active tab shows its label on a belly-pink pill; the others are icon-only. */
export function FloatingTabBar({ active, badges = {}, position = "fixed" }: Props) {
  const t = useTranslations("Ds.nav");
  return (
    <div
      className={cx(
        "pointer-events-none inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-4",
        position === "fixed" ? "fixed" : "relative",
      )}
      style={{ paddingBottom: position === "fixed" ? "max(28px, calc(env(safe-area-inset-bottom) + 12px))" : 0 }}
    >
      <nav
        aria-label={t("label")}
        className="pointer-events-auto flex h-[68px] items-center justify-between rounded-tabbar bg-surface px-2 shadow-cushion"
      >
        {TABS.map(({ id, href, Icon }) => {
          const isActive = id === active;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={isActive ? undefined : t(id)}
              className={cx(
                "ds-press ds-focus relative flex h-[52px] items-center justify-center rounded-full text-[14px] font-bold",
                isActive ? "gap-2 bg-tint px-4 text-on-tint" : "w-[52px] text-muted",
              )}
            >
              <Icon size={24} />
              {isActive ? <span>{t(id)}</span> : null}
              {badges[id] && !isActive ? (
                <span
                  role="img"
                  aria-label={t("newActivity")}
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-progress ring-2 ring-surface"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Bottom padding that keeps content clear of the floating tab bar. */
export const TAB_BAR_CLEARANCE = "calc(68px + max(28px, env(safe-area-inset-bottom) + 12px) + 16px)";
