"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { BuddyMascot, type BuddyPose } from "@/components/ds/BuddyMascot";
import { CoatHeader } from "@/components/ds/CoatHeader";
import { SpeechBubble } from "@/components/ds/SpeechBubble";
import { LegalLinks } from "@/components/ui";

type SetMood = (pose: BuddyPose | undefined) => void;
const MoodContext = createContext<SetMood>(() => {});

/** Forms call this to change Buddy's pose (e.g. "curious" on an error); undefined goes back to the screen's own pose. */
export const useAuthMood = () => useContext(MoodContext);

interface Props {
  /** The screen title (English). */
  title: string;
  /** Buddy's German line, shown in a speech bubble (without the quotation marks). */
  line: string;
  /** Short English helper under the bubble. */
  helper?: string;
  /** Longer explanation, in the white area above the form. */
  intro?: ReactNode;
  pose?: BuddyPose;
  children: ReactNode;
}

/**
 * Every sign-in-side screen: a compact coat block with the title, Buddy's line and Buddy himself, the blaze notch,
 * then the form on the page ground. Phone-width column, centred on wide screens. No tab bar.
 */
export function AuthLayout({ title, line, helper, intro, pose = "neutral", children }: Props) {
  const [mood, setMood] = useState<BuddyPose | undefined>();
  return (
    <MoodContext.Provider value={setMood}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
        <CoatHeader compact>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-2.5">
              <h1 className="text-display">{title}</h1>
              <SpeechBubble>{line}</SpeechBubble>
              {helper ? <p className="text-caption text-on-coat-muted">{helper}</p> : null}
            </div>
            <BuddyMascot pose={mood ?? pose} size={72} className="mt-1 shrink-0" priority />
          </div>
        </CoatHeader>
        <div className="flex flex-1 flex-col gap-4 px-[22px] pt-8">
          {intro ? <p className="text-muted">{intro}</p> : null}
          {children}
        </div>
        <footer className="px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
          <LegalLinks />
        </footer>
      </main>
    </MoodContext.Provider>
  );
}
