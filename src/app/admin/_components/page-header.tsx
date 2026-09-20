import { Container } from "@/components/container";

export function PageHeader({
  kicker,
  title,
  children,
  actions,
}: {
  kicker?: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Container className="pt-10 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h1 className="mt-2 break-words font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {children ? <div className="mt-3 text-paper-muted">{children}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Container>
  );
}
