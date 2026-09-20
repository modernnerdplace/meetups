import Link from "next/link";
import { Container } from "@/components/container";

export default function EventNotFound() {
  return (
    <Container className="pt-12">
      <p className="kicker">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Dit event bestaat niet (meer).</h1>
      <Link href="/admin/events" className="btn-ghost mt-6">
        Naar de events
      </Link>
    </Container>
  );
}
