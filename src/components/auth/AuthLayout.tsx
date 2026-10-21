"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
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
  /** Desktop only: a heading above the form on the right ("Log in"), and a line under it. */
  formTitle?: string;
  formSubtitle?: string;
  pose?: BuddyPose;
  children: ReactNode;
}

/**
 * Every sign-in-side screen. Phone: a compact coat block with the title, Buddy's line and Buddy himself, the blaze notch,
 * then the form on the page ground, in a column of at most 480px (560px from 768px). Desktop (1024px and up): a split
 * screen with the coat as a full-height left panel and the form centred on the right. No tab bar or sidebar.
 */
export function AuthLayout({ title, line, helper, intro, formTitle, formSubtitle, pose = "neutral", children }: Props) {
  const [mood, setMood] = useState<BuddyPose | undefined>();
  const meta = useTranslations("Meta");
  const d = useTranslations("Desktop");
  return (
    <MoodContext.Provider value={setMood}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col tab:max-w-[560px] desk:max-w-none desk:flex-row">
        <CoatHeader compact desktop="panel">
          <div className="hidden items-center gap-3 desk:flex">
            <Image src="/buddy/buddy-icon-light.svg" alt="" width={36} height={36} className="rounded-[10px]" unoptimized />
            <span className="text-[17px] font-bold">{meta("title")}</span>
          </div>
          <div className="flex items-start justify-between gap-3 desk:flex-1 desk:flex-col-reverse desk:items-start desk:justify-center desk:gap-6">
            <div className="flex min-w-0 flex-col items-start gap-2.5 desk:gap-4">
              <h1 className="text-display desk:text-[52px] desk:leading-[1.05]">{title}</h1>
              <SpeechBubble className="desk:px-5 desk:py-3 desk:text-[19px]">{line}</SpeechBubble>
              {helper ? <p className="text-caption text-on-coat-muted desk:text-[16px]">{helper}</p> : null}
            </div>
            <BuddyMascot pose={mood ?? pose} size={72} className="mt-1 shrink-0 desk:mt-0 desk:h-auto desk:w-[240px]" priority />
          </div>
          <p className="hidden text-[14px] text-on-coat-muted desk:block">{d("tagline")}</p>
        </CoatHeader>
        <div className="flex flex-1 flex-col desk:min-h-dvh">
          <div className="flex flex-1 flex-col gap-4 px-[22px] pt-8 desk:mx-auto desk:w-full desk:max-w-[420px] desk:justify-center desk:px-0 desk:pt-10">
            {formTitle ? (
              <div className="hidden desk:block">
                <h2 className="text-[28px] font-extrabold leading-tight">{formTitle}</h2>
                {formSubtitle ? <p className="mt-1 text-muted">{formSubtitle}</p> : null}
              </div>
            ) : null}
            {intro ? <p className="text-muted">{intro}</p> : null}
            {children}
          </div>
          <footer className="px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-4 desk:pb-10">
            <LegalLinks />
          </footer>
        </div>
      </main>
    </MoodContext.Provider>
  );
}
