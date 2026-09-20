import { formatMediumDate, formatTime } from "@/app/(public)/_lib/format";
import type { AuditRow } from "../_lib/queries";

export function AuditList({ rows, empty = "Nog niets gelogd." }: { rows: AuditRow[]; empty?: string }) {
  if (rows.length === 0) {
    return <p className="font-mono text-sm text-paper-faint">$ tail audit.log: {empty}</p>;
  }
  return (
    <ol className="divide-y divide-ink-700 font-mono text-sm">
      {rows.map((row) => (
        <li key={row.id} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <time dateTime={row.createdAt.toISOString()} className="text-xs text-paper-faint sm:text-sm">
            {formatMediumDate(row.createdAt)} {formatTime(row.createdAt)}
          </time>
          <p className="min-w-0 break-words text-paper/90">
            <span className="text-trace-300">{row.actor?.name ?? "systeem"}</span>{" "}
            <span className="text-paper-faint">{row.action}</span> {row.summary}
          </p>
        </li>
      ))}
    </ol>
  );
}
