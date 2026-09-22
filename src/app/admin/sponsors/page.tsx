import { Container } from "@/components/container";
import { getCurrentMember, isAdmin } from "@/lib/auth";
import { EntityManager } from "../_components/entity-manager";
import { PageHeader } from "../_components/page-header";
import { listSponsors } from "../_lib/queries";
import { deleteSponsorAction, saveSponsorAction } from "../programme-actions";

export const metadata = { title: "Sponsors" };

export default async function SponsorsPage() {
  const [sponsors, me] = await Promise.all([listSponsors(), getCurrentMember()]);

  return (
    <>
      <PageHeader kicker={`${sponsors.length} sponsors`} title="Sponsors">
        Wie de zaal, de pizza of de opnames betaalt. Koppel ze per event op de eventpagina.
      </PageHeader>
      <Container className="mt-8 max-w-3xl">
        <EntityManager
          idField="sponsorId"
          addLabel="Sponsor toevoegen"
          emptyLabel="nog geen sponsors"
          canDelete={isAdmin(me)}
          saveAction={saveSponsorAction}
          deleteAction={deleteSponsorAction}
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "url", label: "Website", type: "url" },
            { name: "logoUrl", label: "Logo (URL)", type: "url" },
            { name: "description", label: "Omschrijving", type: "textarea" },
          ]}
          items={sponsors.map((sponsor) => ({
            id: sponsor.id,
            title: sponsor.name,
            subtitle: sponsor.url,
            meta: `/${sponsor.slug} · ${sponsor._count.events} ${sponsor._count.events === 1 ? "event" : "events"}`,
            values: {
              name: sponsor.name,
              url: sponsor.url ?? "",
              logoUrl: sponsor.logoUrl ?? "",
              description: sponsor.description ?? "",
            },
          }))}
        />
      </Container>
    </>
  );
}
