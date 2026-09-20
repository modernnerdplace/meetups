/**
 * Draait de beheerlogica echt tegen de lokale database.
 *
 *   npx tsx src/lib/__checks__/admin.ts
 *
 * Tijdzones, formuliervalidatie, events aanmaken en wijzigen, de wachtlijst bij
 * een hogere capaciteit, acties van organisatoren op aanmeldingen, rollen en de
 * auditlog. Ruimt alles weer op.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { EventStatus, MemberRole, RsvpStatus } from "@prisma/client";

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

const run = randomBytes(4).toString("hex");
let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  const mark = condition ? "ok  " : "FAIL";
  if (!condition) failures += 1;
  console.log(`${mark} ${label}${detail ? ` -> ${detail}` : ""}`);
}

async function rejects(fn: () => Promise<unknown>, includes: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(includes);
  }
}

type Modules = {
  prisma: typeof import("../db")["prisma"];
  time: typeof import("../time");
  events: typeof import("../admin/events");
  rsvps: typeof import("../admin/rsvps");
  members: typeof import("../admin/members");
  rsvp: typeof import("../rsvp");
};
let m: Modules;

const eventIds: string[] = [];
const memberEmail = (name: string) => `check-${run}-${name}@example.invalid`;

function checkTime() {
  const { amsterdamLocalToUtc, utcToAmsterdamLocal } = m.time;
  const summer = amsterdamLocalToUtc("2026-07-01T19:00");
  check("summer time is UTC+2", summer?.toISOString() === "2026-07-01T17:00:00.000Z", summer?.toISOString());
  const winter = amsterdamLocalToUtc("2026-12-01T19:00");
  check("winter time is UTC+1", winter?.toISOString() === "2026-12-01T18:00:00.000Z", winter?.toISOString());
  // 25 oktober 2026: klok gaat om 03:00 terug naar 02:00.
  const afterSwitch = amsterdamLocalToUtc("2026-10-25T12:00");
  check("day of the switch", afterSwitch?.toISOString() === "2026-10-25T11:00:00.000Z", afterSwitch?.toISOString());
  check("round trip", utcToAmsterdamLocal(summer!) === "2026-07-01T19:00", utcToAmsterdamLocal(summer!));
  check("garbage is null", amsterdamLocalToUtc("tomorrow evening") === null);
}

function checkValidation() {
  const { eventInputSchema } = m.events;
  const bad = eventInputSchema.safeParse({
    title: "x",
    slug: "Not A Slug!",
    startsAt: "2026-10-01T19:00",
    endsAt: "2026-10-01T18:00",
    capacity: "-3",
    venueUrl: "javascript:alert(1)",
  });
  const paths = bad.success ? [] : bad.error.issues.map((issue) => issue.path.join("."));
  for (const field of ["title", "slug", "endsAt", "capacity", "venueUrl"]) {
    check(`validation rejects ${field}`, paths.includes(field), JSON.stringify(paths));
  }
  const missingStart = eventInputSchema.safeParse({ title: "Meetup", startsAt: "" });
  check(
    "validation requires a start",
    !missingStart.success && missingStart.error.issues.some((issue) => issue.path[0] === "startsAt"),
  );
  const good = eventInputSchema.safeParse({
    title: "  Meetup  ",
    slug: "",
    summary: "",
    startsAt: "2026-10-01T19:00",
    endsAt: "",
    capacity: "",
  });
  check("empty fields become null", good.success && good.data.slug === null && good.data.capacity === null && good.data.summary === null);
  check("title is trimmed", good.success && good.data.title === "Meetup");
}

async function main() {
  const { prisma } = m;
  checkTime();
  checkValidation();

  const [actor, ann, bob, cas, dan] = await Promise.all(
    ["actor", "ann", "bob", "cas", "dan"].map((name) =>
      prisma.member.create({
        data: {
          name: `${name} ${run}`,
          email: memberEmail(name),
          role: name === "actor" ? MemberRole.ADMIN : MemberRole.MEMBER,
        },
      }),
    ),
  );

  // Event aanmaken: concept, slug op datum plus titel, auditregel.
  const input = m.events.eventInputSchema.parse({
    title: `Modern Nerdplace Check ${run}`,
    startsAt: "2031-03-12T19:00",
    capacity: "2",
  });
  const event = await m.events.createEvent(input, actor.id);
  eventIds.push(event.id);
  check("new event is a draft", event.status === EventStatus.DRAFT, event.status);
  check("default slug", event.slug === `2031-03-12-check-${run}`, event.slug);
  check(
    "create is audited",
    (await prisma.auditLog.count({ where: { entityId: event.id, action: "event.create" } })) === 1,
  );
  check(
    "duplicate slug is refused",
    await rejects(() => m.events.createEvent(input, actor.id), "al in gebruik"),
  );

  // Publiceren, dan vier aanmeldingen op twee plekken.
  await m.events.setEventStatus(event.id, EventStatus.PUBLISHED, actor.id);
  for (const member of [ann, bob, cas, dan]) {
    await m.rsvp.joinEvent({ slug: event.slug, memberId: member.id });
  }
  const rsvpOf = (memberId: string) =>
    prisma.rsvp.findUniqueOrThrow({ where: { eventId_memberId: { eventId: event.id, memberId } } });

  // Capaciteit naar 3: Cas schuift door, Dan wordt nummer 1.
  const raised = m.events.eventInputSchema.parse({
    title: event.title,
    slug: event.slug,
    startsAt: "2031-03-12T19:00",
    capacity: "3",
  });
  const { promotedMemberIds } = await m.events.updateEvent(event.id, raised, actor.id);
  check("raising capacity promotes one", promotedMemberIds.length === 1 && promotedMemberIds[0] === cas.id);
  const danAfterRaise = await rsvpOf(dan.id);
  check("Dan is waitlist #1", danAfterRaise.status === RsvpStatus.WAITLIST && danAfterRaise.waitlistPosition === 1);
  const updateLog = await prisma.auditLog.findFirst({ where: { entityId: event.id, action: "event.update" } });
  check("update log names the changed field", updateLog?.summary.includes("capacity") ?? false, updateLog?.summary);

  // Opslaan zonder wijziging logt niets extra.
  await m.events.updateEvent(event.id, raised, actor.id);
  check(
    "unchanged save is not logged",
    (await prisma.auditLog.count({ where: { entityId: event.id, action: "event.update" } })) === 1,
  );

  // Check-in: wachtlijst mag niet zonder bewuste keuze.
  const danRsvp = await rsvpOf(dan.id);
  check(
    "waitlisted check-in is refused",
    await rejects(() => m.rsvps.checkInRsvp(danRsvp.id, actor.id), "wachtlijst"),
  );
  const annRsvp = await rsvpOf(ann.id);
  const first = await m.rsvps.checkInRsvp(annRsvp.id, actor.id);
  const again = await m.rsvps.checkInRsvp(annRsvp.id, actor.id);
  check("check-in is idempotent", first.checkedInAt.getTime() === again.checkedInAt.getTime());
  await m.rsvps.undoCheckIn(annRsvp.id, actor.id);
  check("undo clears the check-in", (await rsvpOf(ann.id)).checkedInAt === null);
  check(
    "undo is audited",
    (await prisma.auditLog.count({ where: { entityId: annRsvp.id, action: "rsvp.checkin_undo" } })) === 1,
  );

  // Organisator meldt Bob af: niemand meer op de wachtlijst behalve Dan, die schuift door.
  const bobRsvp = await rsvpOf(bob.id);
  const cancelled = await m.rsvps.cancelRsvpAsOrganiser(bobRsvp.id, actor.id);
  check("organiser cancel promotes Dan", cancelled.promotedMemberIds[0] === dan.id);
  check("Bob is cancelled", (await rsvpOf(bob.id)).status === RsvpStatus.CANCELLED);

  // Bob meldt zich opnieuw aan, event is vol: wachtlijst. Toelaten boven capaciteit.
  await m.rsvp.joinEvent({ slug: event.slug, memberId: bob.id });
  const bobBack = await rsvpOf(bob.id);
  check("Bob is back on the waitlist", bobBack.status === RsvpStatus.WAITLIST && bobBack.waitlistPosition === 1);
  await m.rsvps.promoteRsvp(bobBack.id, actor.id);
  const going = await prisma.rsvp.count({ where: { eventId: event.id, status: RsvpStatus.GOING } });
  check("manual promote goes over capacity", going === 4, String(going));

  // Bij de deur van de wachtlijst binnenlaten.
  await m.rsvp.leaveEvent({ slug: event.slug, memberId: cas.id });
  await m.rsvp.joinEvent({ slug: event.slug, memberId: cas.id });
  const casRsvp = await rsvpOf(cas.id);
  check("Cas is waitlisted", casRsvp.status === RsvpStatus.WAITLIST);
  await m.rsvps.checkInRsvp(casRsvp.id, actor.id, { admitFromWaitlist: true });
  const casAfter = await rsvpOf(cas.id);
  check("admit makes Cas going and checked in", casAfter.status === RsvpStatus.GOING && casAfter.checkedInAt !== null);

  // Rollen: de laatste admin kan zichzelf niet weghalen.
  const otherAdmins = await prisma.member.count({ where: { role: MemberRole.ADMIN, id: { not: actor.id } } });
  if (otherAdmins === 0) {
    check(
      "last admin cannot be demoted",
      await rejects(() => m.members.setMemberRole(actor.id, MemberRole.MEMBER, actor.id), "minstens een admin"),
    );
  } else {
    console.log("skip last-admin check: the database already has other admins");
  }
  await m.members.setMemberRole(ann.id, MemberRole.ORGANISER, actor.id);
  check("role change works", (await prisma.member.findUniqueOrThrow({ where: { id: ann.id } })).role === MemberRole.ORGANISER);

  // Audit bevat geen e-mailadressen of opmerkingen.
  const logs = await prisma.auditLog.findMany({ where: { actorId: actor.id } });
  const serialised = JSON.stringify(logs);
  check("audit never contains an email address", !serialised.includes("@example.invalid"));

  // Verwijderen alleen met de juiste titel.
  check(
    "delete needs the exact title",
    await rejects(() => m.events.deleteEvent(event.id, "wrong", actor.id), "precies"),
  );
  await m.events.deleteEvent(event.id, event.title, actor.id);
  check("event is gone", (await prisma.event.count({ where: { id: event.id } })) === 0);
  check("its registrations are gone", (await prisma.rsvp.count({ where: { eventId: event.id } })) === 0);
  check(
    "delete is audited",
    (await prisma.auditLog.count({ where: { entityId: event.id, action: "event.delete" } })) === 1,
  );
}

async function cleanup() {
  const { prisma } = m;
  const actors = await prisma.member.findMany({
    where: { email: { startsWith: `check-${run}-` } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: actors.map((a) => a.id) } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.member.deleteMany({ where: { email: { startsWith: `check-${run}-` } } });
  console.log("\ncleanup done");
}

async function start() {
  loadEnvFile();
  m = {
    prisma: (await import("../db")).prisma,
    time: await import("../time"),
    events: await import("../admin/events"),
    rsvps: await import("../admin/rsvps"),
    members: await import("../admin/members"),
    rsvp: await import("../rsvp"),
  };
  try {
    await main();
  } catch (error) {
    failures += 1;
    console.error("check crashed", error);
  } finally {
    await cleanup();
    await m.prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void start();
