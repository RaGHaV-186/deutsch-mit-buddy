/** Bottom padding that keeps content clear of the floating tab bar. In its own file so server components can read the value (FloatingTabBar is a client component). */
export const TAB_BAR_CLEARANCE = "calc(68px + max(28px, env(safe-area-inset-bottom) + 12px) + 16px)";
