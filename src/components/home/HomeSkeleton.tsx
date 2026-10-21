import { useTranslations } from "next-intl";
import { CoatHeader, FloatingTabBar, Screen, Skeleton } from "@/components/ds";
import { isGameLayerOn } from "@/lib/game-layer";

/**
 * Home while its data loads: the same layout in grey blocks, with the real tab bar so navigation still works.
 * NOT wired up as `home/loading.tsx`: a route-level loading file wraps the page in a Suspense boundary that, in a local
 * production build, intermittently never hydrated (links, theme switch and log out stayed dead). A guard test in
 * home.test.tsx keeps loading.tsx out until that is understood. Shown on /design.
 */
export function HomeSkeleton({ game = isGameLayerOn(), tabBar = "fixed" }: { game?: boolean; tabBar?: "fixed" | "static" }) {
  const t = useTranslations("Ds.states");
  return (
    <>
      <Screen withTabBar={tabBar === "fixed"}>
        <CoatHeader>
          <div className="flex items-start justify-between gap-3" role="status" aria-label={t("loading")}>
            <div className="flex flex-col items-start gap-3">
              <Skeleton onCoat width={210} height={34} radius={12} />
              <Skeleton onCoat width={240} height={38} radius={16} />
            </div>
            <Skeleton onCoat width={58} height={58} radius={29} />
          </div>
          <div className="mt-5 flex flex-col gap-3" aria-hidden="true">
            <Skeleton onCoat width={140} height={14} />
            <Skeleton onCoat width="75%" height={30} />
          </div>
          <Skeleton onCoat height={56} radius={28} className="mt-5" />
        </CoatHeader>
        <div className="flex flex-col gap-3 px-5 pt-5" aria-hidden="true">
          {game ? <Skeleton height={108} radius={28} /> : null}
          <div className={game ? "grid grid-cols-[1.4fr_1fr] gap-3" : undefined}>
            {game ? <Skeleton height={120} radius={28} /> : null}
            <Skeleton height={120} radius={28} />
          </div>
        </div>
      </Screen>
      <FloatingTabBar active="home" position={tabBar} />
    </>
  );
}
