import type { DayStatus } from "@/components/ds/PawStreakWeek";

/**
 * The game layer (treats, level, streak, combo) is built but has no data until slice 10 (XP + friends).
 * NEXT_PUBLIC_GAME_LAYER: "1" or "true" = on, "0" or "false" = off; unset = on in development, off in production.
 * The /design page shows it regardless.
 */
export function isGameLayerOn(env: { flag?: string; nodeEnv?: string } = { flag: process.env.NEXT_PUBLIC_GAME_LAYER, nodeEnv: process.env.NODE_ENV }): boolean {
  const flag = env.flag?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return env.nodeEnv !== "production";
}

/** Treats earned per answer (design brief, game layer): Again 0, Hard 5, Got it 10, Easy 15. Shown only when the game layer is on. */
export const GRADE_TREATS = { again: 0, hard: 5, good: 10, easy: 15 } as const;

export interface GameData {
  /** True while the numbers are placeholders (everything, until slice 10 supplies real data). */
  preview: boolean;
  streak: number;
  /** Monday to Sunday. */
  week: DayStatus[];
  level: number;
  treats: number;
  /** Treats needed for the next level. */
  nextAt: number;
  /** Treats for finishing today's lesson. */
  lessonReward: number;
}

/** Placeholder numbers for developing and reviewing the game-layer UI. Never shown unless the flag is on. */
export const GAME_PREVIEW: GameData = {
  preview: true,
  streak: 10,
  week: ["done", "today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"],
  level: 3,
  treats: 1240,
  nextAt: 1500,
  lessonReward: 50,
};

/** What Home shows for the game layer: nothing when the flag is off. Slice 10 replaces the preview with real data here. */
export function gameDataForHome(on: boolean = isGameLayerOn()): GameData | null {
  return on ? GAME_PREVIEW : null;
}
