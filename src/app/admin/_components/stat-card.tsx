export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="kicker">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 font-mono text-xs text-paper-faint">{hint}</p> : null}
    </div>
  );
}
