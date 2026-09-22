/**
 * Programma tegen de lokale database: sessies met sprekers, volgorde, locaties
 * en sponsors.
 *
 *   npx tsx src/lib/__checks__/programme.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // DATABASE_URL moet dan al gezet zijn.
  }
}

const run = randomBytes(4).toString("hex");
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
};
async function rejects(fn: () => Promise<unknown>, includes: string) {
  try {
    await fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(includes);
  }
}

async function main() {
  const { prisma } = await import("../db");
  const p = await import("../admin/programme");
  const ids: string[] = [];
  const actor = await prisma.member.create({
    data: { name: `Programma ${run}`, email: `check-${run}-actor@example.invalid` },
  });

  try {
    // Validatie
    const bad = p.sessionInputSchema.safeParse({
      title: "x",
      startsAt: "2031-01-01T20:00",
      endsAt: "2031-01-01T19:00",
      slidesUrl: "ftp://nope",
      speakerIds: "a,b,c,d,e,f,g",
    });
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    for (const f of ["title", "endsAt", "slidesUrl", "speakerIds"]) {
      check(`validatie weigert ${f}`, paths.includes(f), JSON.stringify(paths));
    }
    const dedup = p.sessionInputSchema.parse({ title: "Keynote", speakerIds: " a , a , b " });
    check("dubbele sprekers eruit", JSON.stringify(dedup.speakerIds) === '["a","b"]', JSON.stringify(dedup.speakerIds));

    // Sprekers met botsende naam krijgen een eigen slug
    const s1 = await p.createSpeaker(p.speakerInputSchema.parse({ name: `Nerd ${run}` }), actor.id);
    const s2 = await p.createSpeaker(p.speakerInputSchema.parse({ name: `Nerd ${run}` }), actor.id);
    check("tweede spreker krijgt eigen slug", s1.slug !== s2.slug, `${s1.slug} / ${s2.slug}`);

    const event = await prisma.event.create({
      data: {
        slug: `check-programme-${run}`,
        title: `Programma check ${run}`,
        status: "PUBLISHED",
        startsAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });
    ids.push(event.id);

    // Sessies aanmaken, volgorde en sprekers
    const a = await p.createSession(
      event.id,
      p.sessionInputSchema.parse({ title: "Opening", startsAt: "2031-04-02T19:00", speakerIds: s1.id }),
      actor.id,
    );
    const b = await p.createSession(
      event.id,
      p.sessionInputSchema.parse({ title: "Talk twee", speakerIds: `${s1.id},${s2.id}`, room: "Zaal 2" }),
      actor.id,
    );
    check("posities lopen op", a.position === 0 && b.position === 1, `${a.position}/${b.position}`);
    const withSpeakers = await prisma.eventSession.findUniqueOrThrow({
      where: { id: b.id },
      include: { speakers: true },
    });
    check("twee sprekers gekoppeld", withSpeakers.speakers.length === 2);
    check(
      "tijden staan in UTC",
      a.startsAt?.toISOString() === "2031-04-02T17:00:00.000Z",
      a.startsAt?.toISOString(),
    );

    // Verplaatsen
    await p.moveSession(b.id, "up", actor.id);
    const order = await prisma.eventSession.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" } });
    check("omhoog verplaatst", order[0].id === b.id, order.map((s) => s.title).join(" | "));
    await p.moveSession(order[0].id, "up", actor.id);
    check("bovenste omhoog doet niets", (await prisma.eventSession.findFirstOrThrow({ where: { eventId: event.id }, orderBy: { position: "asc" } })).id === b.id);

    // Sprekers vervangen bij een update
    await p.updateSession(b.id, p.sessionInputSchema.parse({ title: "Talk twee", speakerIds: s2.id }), actor.id);
    const after = await prisma.eventSession.findUniqueOrThrow({ where: { id: b.id }, include: { speakers: true } });
    check("sprekers vervangen, niet opgeteld", after.speakers.length === 1 && after.speakers[0].speakerId === s2.id);

    // Spreker met sessie mag niet weg
    check(
      "spreker in gebruik is beschermd",
      await rejects(() => p.deleteSpeaker(s2.id, actor.id), "staat nog bij een sessie"),
    );

    // Locatie koppelen vult de eventvelden
    const venue = await p.createVenue(
      p.venueInputSchema.parse({ name: `Cloudspace ${run}`, address: "Ergens 1", city: "Breda", url: "https://example.com", notes: "sleutel bij de balie" }),
      actor.id,
    );
    await p.setEventVenue(event.id, venue.id, actor.id);
    const linked = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    check("event wijst naar de locatie", linked.venueId === venue.id);
    check("naam en adres overgenomen", linked.venueName === venue.name && linked.venueAddress === "Ergens 1");
    check(
      "locatie in gebruik is beschermd",
      await rejects(() => p.deleteVenue(venue.id, actor.id), "hangt nog aan een event"),
    );
    await p.setEventVenue(event.id, null, actor.id);
    check("loskoppelen wist de velden", (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).venueName === null);

    // Sponsors
    const sp1 = await p.createSponsor(p.sponsorInputSchema.parse({ name: `Sponsor A ${run}` }), actor.id);
    const sp2 = await p.createSponsor(p.sponsorInputSchema.parse({ name: `Sponsor B ${run}` }), actor.id);
    await p.setEventSponsors(event.id, [{ sponsorId: sp1.id, role: "pizza" }, { sponsorId: sp2.id, role: null }], actor.id);
    check("twee sponsors gekoppeld", (await prisma.eventSponsor.count({ where: { eventId: event.id } })) === 2);
    await p.setEventSponsors(event.id, [{ sponsorId: sp2.id, role: "zaal" }], actor.id);
    const left = await prisma.eventSponsor.findMany({ where: { eventId: event.id } });
    check("opnieuw zetten vervangt de lijst", left.length === 1 && left[0].sponsorId === sp2.id && left[0].role === "zaal");

    // Auditregels en opruimen
    const logs = await prisma.auditLog.count({ where: { actorId: actor.id } });
    check("alles is gelogd", logs >= 10, String(logs));
    await p.deleteSession(a.id, actor.id);
    check("sessie verwijderd", (await prisma.eventSession.count({ where: { eventId: event.id } })) === 1);
    await prisma.event.delete({ where: { id: event.id } });
    check("sessies verdwijnen met het event", (await prisma.eventSession.count({ where: { eventId: event.id } })) === 0);
    check("sponsorkoppeling verdwijnt mee", (await prisma.eventSponsor.count({ where: { eventId: event.id } })) === 0);
  } catch (error) {
    failures += 1;
    console.error("check crashed", error);
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: actor.id } });
    await prisma.event.deleteMany({ where: { slug: `check-programme-${run}` } });
    await prisma.speaker.deleteMany({ where: { name: { contains: run } } });
    await prisma.venue.deleteMany({ where: { name: { contains: run } } });
    await prisma.sponsor.deleteMany({ where: { name: { contains: run } } });
    await prisma.member.deleteMany({ where: { email: { startsWith: `check-${run}-` } } });
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
