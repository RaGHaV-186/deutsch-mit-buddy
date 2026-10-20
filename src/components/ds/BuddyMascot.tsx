import Image from "next/image";

export type BuddyPose = "neutral" | "talking" | "curious" | "happy" | "resting" | "listening";
export const BUDDY_POSES: BuddyPose[] = ["neutral", "talking", "curious", "happy", "resting", "listening"];

/** Buddy artwork (viewBox 220 x 230). Decorative: the surrounding text says what is going on. */
export function BuddyMascot({ pose = "neutral", size = 72, className, priority = false }: { pose?: BuddyPose; size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={`/buddy/buddy-${pose}.svg`}
      alt=""
      width={size}
      height={Math.round((size * 230) / 220)}
      className={className}
      unoptimized
      priority={priority}
    />
  );
}
