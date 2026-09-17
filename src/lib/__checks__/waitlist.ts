/**
 * Draait de wachtlijstlogica echt tegen de lokale database.
 *
 *   npx tsx src/lib/__checks__/waitlist.ts
 *
 * Maakt een tijdelijk event met capacity 2, meldt vier leden aan, meldt er een af
 * en controleert dat de eerste van de wachtlijst doorschuift. Ruimt alles weer op.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { EventStatus, RsvpStatus } from "@prisma/client";

// .env inlezen voordat de Prisma-client geladen wordt.
function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Geen .env: dan moet DATABASE_URL al in de omgeving staan.
  }
}

type Db = typeof import("../db")["prisma"];
type Rsvp = typeof import("../rsvp");

let prisma: Db;
let joinEvent: Rsvp["joinEvent"];
let leaveEvent: Rsvp["leaveEvent"];

const run = randomBytes(4).toString("hex");
const slug = `check-waitlist-${run}`;
const openSlug = `check-open-${run}`;
let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  const mark = condition ? "ok  " : "FAIL";
  if (!condition) failures += 1;
  console.log(`${mark} ${label}${detail ? ` -> ${detail}` : ""}`);
}

async function board(eventSlug: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug } });
  const rsvps = await prisma.rsvp.findMany({
    where: { eventId: event.id },
    orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { createdAt: "asc" }],
    include: { member: { select: { name: true } } },
  });
  return rsvps.map((rsvp) => ({
    name: rsvp.member.name,
    status: rsvp.status,
    position: rsvp.waitlistPosition,
  }));
}

async function main() {
  const names = ["Ann", "Bob", "Cas", "Dan", "Eef"];
  const members = [];
  for (const name of names) {
    members.push(
      await prisma.member.create({
        data: { name: `${name} ${run}`, email: `check-${run}-${name.toLowerCase()}@example.invalid` },
      }),
    );
  }
  const [ann, bob, cas, dan, eef] = members;

  const event = await prisma.event.create({
    data: {
      slug,
      title: `Waitlist check ${run}`,
      status: EventStatus.PUBLISHED,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      capacity: 2,
    },
  });

  console.log(`event ${event.slug} (capacity ${event.capacity})\n`);

  // 1. Vier aanmeldingen op twee plekken.
  const results = [];
  for (const member of [ann, bob, cas, dan]) {
    results.push(await joinEvent({ slug, memberId: member.id, note: "no nuts please" }));
  }
  check("Ann is going", results[0].status === RsvpStatus.GOING, results[0].status);
  check("Bob is going", results[1].status === RsvpStatus.GOING, results[1].status);
  check(
    "Cas is on the waitlist at 1",
    results[2].status === RsvpStatus.WAITLIST && results[2].waitlistPosition === 1,
    `${results[2].status} ${results[2].waitlistPosition}`,
  );
  check(
    "Dan is on the waitlist at 2",
    results[3].status === RsvpStatus.WAITLIST && results[3].waitlistPosition === 2,
    `${results[3].status} ${results[3].waitlistPosition}`,
  );
  console.log("  after four sign-ups:", JSON.stringify(await board(slug)));

  // 2. Aanmelden geeft nooit de opmerking terug.
  check("the note never comes back in the result", !("note" in results[0]));

  // 3. Ann meldt zich af, Cas schuift door en Dan wordt nummer 1.
  const left = await leaveEvent({ slug, memberId: ann.id });
  check("Ann is cancelled", left.status === RsvpStatus.CANCELLED, left.status);
  check("one person was promoted", left.promotedMemberIds.length === 1, String(left.promotedMemberIds.length));
  check("Cas was the one promoted", left.promotedMemberIds[0] === cas.id);

  const afterLeave = await board(slug);
  console.log("  after Ann leaves:      ", JSON.stringify(afterLeave));
  const casRow = afterLeave.find((row) => row.name.startsWith("Cas"));
  const danRow = afterLeave.find((row) => row.name.startsWith("Dan"));
  check("Cas is going now", casRow?.status === RsvpStatus.GOING, String(casRow?.status));
  check("Cas has no waitlist position", casRow?.position === null, String(casRow?.position));
  check(
    "Dan moved up to position 1",
    danRow?.status === RsvpStatus.WAITLIST && danRow?.position === 1,
    `${danRow?.status} ${danRow?.position}`,
  );
  check(
    "still two people going",
    afterLeave.filter((row) => row.status === RsvpStatus.GOING).length === 2,
  );

  // 4. Opnieuw aanmelden na afmelden werkt via update, niet via een tweede rij.
  const back = await joinEvent({ slug, memberId: ann.id });
  const annRows = await prisma.rsvp.count({ where: { eventId: event.id, memberId: ann.id } });
  check("Ann has exactly one row", annRows === 1, String(annRows));
  check(
    "Ann is back on the waitlist at 2",
    back.status === RsvpStatus.WAITLIST && back.waitlistPosition === 2,
    `${back.status} ${back.waitlistPosition}`,
  );

  // 5. Twee gelijktijdige afmeldingen mogen niet twee mensen op dezelfde plek zetten.
  await Promise.all([
    leaveEvent({ slug, memberId: bob.id }),
    leaveEvent({ slug, memberId: cas.id }),
  ]);
  const afterRace = await board(slug);
  console.log("  after two cancels:     ", JSON.stringify(afterRace));
  const going = afterRace.filter((row) => row.status === RsvpStatus.GOING);
  const waiting = afterRace.filter((row) => row.status === RsvpStatus.WAITLIST);
  const positions = waiting.map((row) => row.position);
  check("still two people going", going.length === 2, String(going.length));
  check(
    "waitlist is numbered 1..n without gaps",
    positions.every((position, index) => position === index + 1),
    JSON.stringify(positions),
  );

  // 6. Zonder capacity is er geen limiet.
  await prisma.event.create({
    data: {
      slug: openSlug,
      title: `Open check ${run}`,
      status: EventStatus.PUBLISHED,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const openResults = [];
  for (const member of members) {
    openResults.push(await joinEvent({ slug: openSlug, memberId: member.id }));
  }
  check(
    "everyone is going when there is no capacity",
    openResults.every((result) => result.status === RsvpStatus.GOING),
  );

  // 7. Een event dat al begonnen is neemt geen aanmeldingen meer aan.
  await prisma.event.update({
    where: { slug: openSlug },
    data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) },
  });
  let refusedStarted = false;
  try {
    await joinEvent({ slug: openSlug, memberId: eef.id });
  } catch (error) {
    refusedStarted = error instanceof Error && error.message.includes("already started");
  }
  check("sign-up closes once the event started", refusedStarted);

  // 8. Een concept neemt ook geen aanmeldingen aan.
  await prisma.event.update({
    where: { slug: openSlug },
    data: { status: EventStatus.DRAFT, startsAt: new Date(Date.now() + 86_400_000) },
  });
  let refusedDraft = false;
  try {
    await joinEvent({ slug: openSlug, memberId: eef.id });
  } catch (error) {
    refusedDraft = error instanceof Error && error.message.includes("not open yet");
  }
  check("a draft refuses sign-ups", refusedDraft);
}

async function cleanup() {
  await prisma.event.deleteMany({ where: { slug: { in: [slug, openSlug] } } });
  await prisma.member.deleteMany({ where: { email: { startsWith: `check-${run}-` } } });
  const leftOver = await prisma.member.count({ where: { email: { startsWith: `check-${run}-` } } });
  console.log(`\ncleanup done, ${leftOver} test members left behind`);
}

async function start() {
  loadEnvFile();
  prisma = (await import("../db")).prisma;
  const rsvp = await import("../rsvp");
  joinEvent = rsvp.joinEvent;
  leaveEvent = rsvp.leaveEvent;

  try {
    await main();
  } catch (error) {
    failures += 1;
    console.error("check crashed", error);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void start();
