export const DEFAULT_TIMEZONE = "Europe/Berlin";

/** Falls back to the default for a timezone name the runtime doesn't know. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Calendar date in `tz` as YYYY-MM-DD. */
export function localDayKey(date: Date, tz: string): string {
  const { year, month, day } = zonedParts(date, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant when the calendar day (year, month, day) starts in `tz`. Handles 23- and 25-hour days. */
function startOfZonedDay(year: number, month: number, day: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

/** Midnight at the end of the local day containing `now`. */
export function startOfNextLocalDay(now: Date, tz: string): Date {
  const { year, month, day } = zonedParts(now, tz);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return startOfZonedDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
}

/** Midnight at the start of the local day containing `now`. */
export function startOfLocalDay(now: Date, tz: string): Date {
  const { year, month, day } = zonedParts(now, tz);
  return startOfZonedDay(year, month, day, tz);
}
