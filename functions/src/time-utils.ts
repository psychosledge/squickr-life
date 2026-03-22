/**
 * Pure time utility functions — no Firebase dependencies.
 * Used by Cloud Functions for habit reminder scheduling.
 */

/**
 * Returns the current local time as "HH:MM" for a given IANA timezone.
 * e.g. getCurrentLocalTime('America/New_York') → "08:30"
 */
export function getCurrentLocalTime(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  // Intl may return "24" for midnight in some environments — normalize to "00"
  const normalizedHour = hour === "24" ? "00" : hour;

  return `${normalizedHour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/**
 * Returns today's date as "YYYY-MM-DD" for a given IANA timezone.
 */
export function getCurrentLocalDate(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // en-CA locale formats dates as YYYY-MM-DD natively
  return formatter.format(now);
}

/**
 * Returns true if targetTime (HH:MM) is within ±windowMinutes of currentTime (HH:MM).
 * Handles midnight wraparound (e.g. 23:58 is within 7 min of 00:03).
 */
export function isWithinTimeWindow(
  currentTime: string,
  targetTime: string,
  windowMinutes = 7
): boolean {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const totalMinutesInDay = 24 * 60;
  const current = toMinutes(currentTime);
  const target = toMinutes(targetTime);

  // Calculate absolute difference, then take the shorter arc around midnight
  const diff = Math.abs(target - current);
  const wrappedDiff = Math.min(diff, totalMinutesInDay - diff);

  return wrappedDiff <= windowMinutes;
}
