import { clsx } from "clsx";

import {
  amsterdamYear,
  formatDayNumber,
  formatMonthShort,
  formatWeekdayShort,
  isoDate,
} from "@/app/(public)/_lib/format";

/** De datum als blok op een affiche: dag groot, maand en jaar klein. */
export function DateBlock({
  date,
  size = "md",
  showYear = true,
  className,
}: {
  date: Date;
  size?: "sm" | "md" | "lg";
  showYear?: boolean;
  className?: string;
}) {
  const day = formatDayNumber(date);
  const month = formatMonthShort(date);
  const year = amsterdamYear(date);

  return (
    <time
      dateTime={isoDate(date)}
      className={clsx("flex shrink-0 flex-col items-center leading-none", className)}
    >
      <span className="kicker mb-1 text-[0.625rem]">{formatWeekdayShort(date)}</span>
      <span
        className={clsx(
          "font-display font-bold tabular-nums text-paper",
          size === "lg" && "text-6xl sm:text-7xl",
          size === "md" && "text-4xl",
          size === "sm" && "text-3xl",
        )}
      >
        {day}
      </span>
      <span
        className={clsx(
          "mt-1 font-display font-bold uppercase tracking-[0.18em] text-rocket-400",
          size === "lg" ? "text-base" : "text-xs",
        )}
      >
        {month}
        {showYear ? ` ${year}` : ""}
      </span>
    </time>
  );
}
