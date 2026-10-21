import { FloatingTabBar, type TabId } from "./FloatingTabBar";
import { Sidebar } from "./Sidebar";

/** The app's navigation: the floating tab bar on phones, the sidebar on desktop. Screens render this once. */
export function AppNav({ active, position = "fixed", badges }: { active: TabId; position?: "fixed" | "static"; badges?: Partial<Record<TabId, boolean>> }) {
  return (
    <>
      <FloatingTabBar active={active} position={position} badges={badges} className="desk:hidden" />
      <Sidebar active={active} />
    </>
  );
}
