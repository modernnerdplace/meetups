// Alles in de database staat in UTC. Op de site tonen we Europe/Amsterdam.
const TZ = "Europe/Amsterdam";
const LOCALE = "nl-NL";

function fmt(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...options });
}

const longDate = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const mediumDate = fmt({ day: "numeric", month: "long", year: "numeric" });
const dayNumber = fmt({ day: "numeric" });
const monthShort = fmt({ month: "short" });
const weekdayShort = fmt({ weekday: "short" });
const yearOnly = fmt({ year: "numeric" });
const timeOnly = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });

export const formatLongDate = (d: Date) => longDate.format(d);
export const formatMediumDate = (d: Date) => mediumDate.format(d);
export const formatDayNumber = (d: Date) => dayNumber.format(d);
export const formatWeekdayShort = (d: Date) => weekdayShort.format(d).replace(/\.$/, "");
export const formatTime = (d: Date) => timeOnly.format(d);

export const formatMonthShort = (d: Date) => monthShort.format(d).replace(/\.$/, "").toLowerCase();

/** Het jaar zoals het in Amsterdam gold, niet het UTC-jaar. */
export const amsterdamYear = (d: Date) => Number(yearOnly.format(d));

export function formatTimeRange(start: Date, end?: Date | null) {
  if (!end) return formatTime(start);
  return `${formatTime(start)} tot ${formatTime(end)}`;
}

/** Waarde voor het dateTime-attribuut van <time>. */
export const isoDate = (d: Date) => d.toISOString();
