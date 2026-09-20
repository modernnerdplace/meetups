import { clsx } from "clsx";

const tones = {
  neutral: "border-ink-600 text-paper-muted",
  ok: "border-mint/40 text-mint",
  warn: "border-spark/40 text-spark",
  danger: "border-rocket/50 text-rocket-300",
  info: "border-trace/40 text-trace-300",
} as const;

export type BadgeTone = keyof typeof tones;

/** Klein label in terminalstijl: `[ ok ] published`. */
export function TerminalBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
