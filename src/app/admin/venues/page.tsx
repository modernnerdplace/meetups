import { Container } from "@/components/container";
import { getCurrentMember, isAdmin } from "@/lib/auth";
import { EntityManager } from "../_components/entity-manager";
import { PageHeader } from "../_components/page-header";
import { listVenues } from "../_lib/queries";
import { deleteVenueAction, saveVenueAction } from "../programme-actions";

export const metadata = { title: "Locaties" };

export default async function VenuesPage() {
  const [venues, me] = await Promise.all([listVenues(), getCurrentMember()]);

  return (
    <>
      <PageHeader kicker={`${venues.length} locaties`} title="Locaties">
        De plekken waar we te gast zijn. Notities zijn alleen voor organisatoren.
      </PageHeader>
      <Container className="mt-8 max-w-3xl">
        <EntityManager
          idField="venueId"
          addLabel="Locatie toevoegen"
          emptyLabel="nog geen locaties"
          canDelete={isAdmin(me)}
          saveAction={saveVenueAction}
          deleteAction={deleteVenueAction}
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "city", label: "Plaats" },
            { name: "address", label: "Adres" },
            { name: "url", label: "Website", type: "url" },
            {
              name: "notes",
              label: "Notities voor organisatoren",
              type: "textarea",
              hint: "Parkeren, sleutels, contactpersoon. Staat nooit op de site.",
            },
          ]}
          items={venues.map((venue) => ({
            id: venue.id,
            title: venue.name,
            subtitle: [venue.address, venue.city].filter(Boolean).join(", ") || null,
            meta: `/${venue.slug} · ${venue._count.events} ${venue._count.events === 1 ? "event" : "events"}`,
            lockedReason: venue._count.events > 0 ? "Hangt nog aan een event" : null,
            values: {
              name: venue.name,
              city: venue.city ?? "",
              address: venue.address ?? "",
              url: venue.url ?? "",
              notes: venue.notes ?? "",
            },
          }))}
        />
      </Container>
    </>
  );
}
