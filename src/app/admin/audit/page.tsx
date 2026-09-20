import { Container } from "@/components/container";
import { AuditList } from "../_components/audit-list";
import { PageHeader } from "../_components/page-header";
import { listAudit } from "../_lib/queries";

export const metadata = { title: "Auditlog" };

export default async function AuditPage() {
  const rows = await listAudit({ take: 300 });
  return (
    <>
      <PageHeader kicker="append-only" title="Auditlog">
        Wie wat heeft veranderd in het beheer. De laatste 300 regels.
      </PageHeader>
      <Container className="mt-8">
        <div className="panel p-4 sm:p-6">
          <AuditList rows={rows} />
        </div>
      </Container>
    </>
  );
}
