import { clsx } from "clsx";

import { renderMarkdown } from "@/app/(public)/_lib/markdown";

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={clsx("prose-nerd", className)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
