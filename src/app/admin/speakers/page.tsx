import { Container } from "@/components/container";
import { getCurrentMember, isAdmin } from "@/lib/auth";
import { EntityManager } from "../_components/entity-manager";
import { PageHeader } from "../_components/page-header";
import { listMembersForSpeaker, listSpeakers } from "../_lib/queries";
import { deleteSpeakerAction, saveSpeakerAction } from "../programme-actions";

export const metadata = { title: "Sprekers" };

function link(links: unknown, key: string): string {
  if (!links || typeof links !== "object" || Array.isArray(links)) return "";
  const value = (links as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default async function SpeakersPage() {
  const [speakers, members, me] = await Promise.all([listSpeakers(), listMembersForSpeaker(), getCurrentMember()]);

  return (
    <>
      <PageHeader kicker={`${speakers.length} sprekers`} title="Sprekers">
        Iedereen die bij ons een sessie gaf. Een spreker hoeft geen account te hebben, maar je kunt hem wel aan
        een lid koppelen.
      </PageHeader>
      <Container className="mt-8 max-w-3xl">
        <EntityManager
          idField="speakerId"
          addLabel="Spreker toevoegen"
          emptyLabel="nog geen sprekers"
          canDelete={isAdmin(me)}
          saveAction={saveSpeakerAction}
          deleteAction={deleteSpeakerAction}
          fields={[
            { name: "name", label: "Naam", required: true },
            { name: "avatarUrl", label: "Foto (URL)", type: "url" },
            { name: "bio", label: "Bio", type: "textarea", hint: "Komt op de sprekerspagina." },
            { name: "website", label: "Website", type: "url" },
            { name: "linkedin", label: "LinkedIn", type: "url" },
            { name: "mastodon", label: "Mastodon", type: "url" },
            {
              name: "memberId",
              label: "Gekoppeld lid",
              type: "select",
              hint: "Optioneel: dan hoort de spreker bij een account.",
              options: [
                { value: "", label: "Geen" },
                ...members.map((member) => ({ value: member.id, label: member.name })),
              ],
            },
          ]}
          items={speakers.map((speaker) => ({
            id: speaker.id,
            title: speaker.name,
            subtitle: speaker.member ? `gekoppeld aan ${speaker.member.name}` : null,
            meta: `/${speaker.slug} · ${speaker._count.sessions} ${speaker._count.sessions === 1 ? "sessie" : "sessies"}`,
            lockedReason: speaker._count.sessions > 0 ? "Staat nog bij een sessie" : null,
            values: {
              name: speaker.name,
              avatarUrl: speaker.avatarUrl ?? "",
              bio: speaker.bio ?? "",
              website: link(speaker.links, "website"),
              linkedin: link(speaker.links, "linkedin"),
              mastodon: link(speaker.links, "mastodon"),
              memberId: speaker.memberId ?? "",
            },
          }))}
        />
      </Container>
    </>
  );
}
