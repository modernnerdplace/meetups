import { clsx } from "clsx";

/** Balkje met bezetting. Zonder capaciteit alleen het aantal. */
export function CapacityIndicator({
  going,
  capacity,
  waitlist,
  className,
}: {
  going: number;
  capacity: number | null;
  waitlist: number;
  className?: string;
}) {
  const ratio = capacity ? Math.min(1, going / capacity) : 0;
  const full = capacity !== null && going >= capacity;
  return (
    <div className={clsx("min-w-[8rem]", className)}>
      <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
        <span className="text-paper">
          {going}
          {capacity ? <span className="text-paper-faint">/{capacity}</span> : null}
        </span>
        {waitlist > 0 ? <span className="text-spark">+{waitlist} wacht</span> : null}
      </div>
      {capacity ? (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={going}
          aria-label="Bezetting"
        >
          <div
            className={clsx("h-full rounded-full", full ? "bg-rocket" : "bg-trace")}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
