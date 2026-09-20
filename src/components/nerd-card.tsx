import Link from "next/link";

import { NerdAvatar } from "./nerd-avatar";
import { NerdBadges } from "./nerd-badges";

export type NerdCardData = {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  company: string | null;
  jobTitle: string | null;
  isMvp: boolean;
  isMct: boolean;
  interests: string[];
  attended: number;
};

export function NerdCard({ nerd }: { nerd: NerdCardData }) {
  const role = [nerd.jobTitle, nerd.company].filter(Boolean).join(" @ ");
  return (
    <Link
      href={`/nerds/${nerd.username}`}
      className="panel group flex h-full flex-col gap-4 p-5 transition-colors hover:border-trace/60"
    >
      <div className="flex items-center gap-4">
        <NerdAvatar name={nerd.name} src={nerd.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold group-hover:text-trace-300">{nerd.name}</p>
          {role ? <p className="truncate text-sm text-paper-muted">{role}</p> : null}
        </div>
      </div>
      <NerdBadges isMvp={nerd.isMvp} isMct={nerd.isMct} />
      {nerd.interests.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Interesses">
          {nerd.interests.slice(0, 4).map((tag) => (
            <li key={tag} className="rounded-full border border-ink-600 px-2 py-0.5 text-xs text-paper-muted">
              {tag}
            </li>
          ))}
          {nerd.interests.length > 4 ? (
            <li className="px-1 py-0.5 text-xs text-paper-faint">+{nerd.interests.length - 4}</li>
          ) : null}
        </ul>
      ) : null}
      <p className="mt-auto font-mono text-xs text-paper-faint">
        {nerd.attended === 0 ? "nog geen meetup" : nerd.attended === 1 ? "1 meetup" : `${nerd.attended} meetups`}
      </p>
    </Link>
  );
}
