import { z } from "zod";
import { GRADES } from "@/lib/srs";

// Shared by the seed import, the sync API and (later) Buddy's "add card" tool: learner text flows into these, so every string has a cap.
export const CARD_KINDS = ["word", "say", "answer"] as const;
export const ARTICLES = ["der", "die", "das"] as const;

export const cardKindSchema = z.enum(CARD_KINDS);
export const articleSchema = z.enum(ARTICLES);
export const gradeSchema = z.enum(GRADES);

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** A card as stored and shown (camelCase). */
export const cardInputSchema = z.object({
  kind: cardKindSchema,
  en: text(300),
  article: articleSchema.nullish().transform((v) => v ?? null),
  de: text(300),
  plural: optionalText(200),
  example: optionalText(300),
  exampleEn: optionalText(300),
  tip: optionalText(300),
  sessionCode: optionalText(12),
});
export type CardInput = z.output<typeof cardInputSchema>;

/** One entry of data/seed-cards.json. */
export const seedCardSchema = z
  .object({
    day: z.number().int().min(1).max(999),
    kind: cardKindSchema,
    en: text(300),
    art: articleSchema.nullable(),
    de: text(300),
    pl: optionalText(200),
    ex: optionalText(300),
    ex_en: optionalText(300),
    tip: optionalText(300),
  })
  .strict();
export type SeedCard = z.output<typeof seedCardSchema>;
export const seedDeckSchema = z.array(seedCardSchema).max(2000);

const isoDate = z.iso.datetime({ offset: true });

/** One answer given on a device, possibly offline. The id is generated on the device so retries are harmless. */
export const reviewEventSchema = z.object({
  id: z.uuid(),
  cardId: z.uuid(),
  grade: gradeSchema,
  reviewedAt: isoDate,
  msTaken: z.number().int().min(0).max(600_000),
});
export type ReviewEventInput = z.output<typeof reviewEventSchema>;

export const MAX_SYNC_EVENTS = 500;
export const syncRequestSchema = z.object({ reviews: z.array(reviewEventSchema).min(1).max(MAX_SYNC_EVENTS) });

export const snapshotRequestSchema = z.object({});

export const srsStateSchema = z.object({
  dueAt: isoDate,
  intervalDays: z.number().min(0).max(3650),
  ease: z.number().min(1.3).max(3),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  lastReviewedAt: isoDate.nullable(),
});

/** A card plus its schedule, as kept in the offline store. */
export const snapshotCardSchema = cardInputSchema.extend({
  id: z.uuid(),
  createdAt: isoDate,
  srs: srsStateSchema,
});
export type SnapshotCard = z.output<typeof snapshotCardSchema>;

export const snapshotResponseSchema = z.object({
  /** Server time, to spot a badly set phone clock. */
  now: isoDate,
  /** Cards first reviewed today (profile timezone); counts against the daily new-card limit. */
  newToday: z.number().int().min(0),
  timezone: z.string().max(64),
  cards: z.array(snapshotCardSchema),
});
export type SnapshotResponse = z.output<typeof snapshotResponseSchema>;

export const syncResponseSchema = z.object({
  /** Event ids the server has recorded (applied or not). The device may drop these from its queue. */
  acknowledged: z.array(z.uuid()),
  /** Authoritative schedules for the cards that were touched. */
  cards: z.array(z.object({ id: z.uuid(), srs: srsStateSchema })),
});
export type SyncResponse = z.output<typeof syncResponseSchema>;
