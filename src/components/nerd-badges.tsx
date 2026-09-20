export function NerdBadges({ isMvp, isMct }: { isMvp: boolean; isMct: boolean }) {
  if (!isMvp && !isMct) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {isMvp ? (
        <span className="rounded border border-spark/50 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-spark">
          MVP
        </span>
      ) : null}
      {isMct ? (
        <span className="rounded border border-mint/50 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-mint">
          MCT
        </span>
      ) : null}
    </span>
  );
}
