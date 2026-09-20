// Omrekenen tussen UTC (database) en Amsterdamse wandkloktijd (formulieren).
// Een <input type="datetime-local"> geeft "2026-10-01T19:00" zonder tijdzone;
// dat is altijd bedoeld als Amsterdamse tijd, ook als de server in UTC draait.

export const TIME_ZONE = "Europe/Amsterdam";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function amsterdamParts(date: Date) {
  const map: Record<string, string> = {};
  for (const part of parts.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Verschil tussen Amsterdam en UTC op dat moment, in milliseconden. */
function offsetAt(date: Date): number {
  const p = amsterdamParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** "2026-10-01T19:00" in Amsterdam naar een UTC-Date. Null bij onzin. */
export function amsterdamLocalToUtc(value: string): Date | null {
  const match = LOCAL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(wall)) return null;
  // Twee rondes, zodat ook de dag van de zomertijdwissel klopt.
  let utc = wall - offsetAt(new Date(wall));
  utc = wall - offsetAt(new Date(utc));
  return new Date(utc);
}

/** UTC-Date naar de waarde voor een datetime-local veld. */
export function utcToAmsterdamLocal(date: Date): string {
  const p = amsterdamParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Datum in Amsterdam als YYYY-MM-DD, voor slugs. */
export function amsterdamDateStamp(date: Date): string {
  return utcToAmsterdamLocal(date).slice(0, 10);
}
