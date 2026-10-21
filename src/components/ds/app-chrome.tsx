"use client";

import { createContext, useContext, type ReactNode } from "react";

/** What the desktop sidebar shows besides the navigation: the learner's initial and the Cards badge. Provided by the app layout. */
export interface AppChrome {
  initial: string;
  /** Cards to review today plus new ones; 0 hides the badge. */
  due: number;
}

const Ctx = createContext<AppChrome>({ initial: "", due: 0 });
export const AppChromeProvider = ({ value, children }: { value: AppChrome; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useAppChrome = () => useContext(Ctx);
