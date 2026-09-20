import { Container } from "@/components/container";
import { createEventAction } from "../../actions";
import { EventForm, emptyEventValues } from "../../_components/event-form";
import { PageHeader } from "../../_components/page-header";

export const metadata = { title: "Nieuw event" };

export default function NewEventPage() {
  return (
    <>
      <PageHeader kicker="touch event.md" title="Nieuw event">
        Het event komt eerst als concept binnen. Publiceren doe je daarna.
      </PageHeader>
      <Container className="mt-8 max-w-3xl">
        <EventForm action={createEventAction} values={emptyEventValues} submitLabel="Concept opslaan" />
      </Container>
    </>
  );
}
