# Architecture

How the platform is put together and why. The product brief (a longer spec for a
full community platform) is used as a backlog, not as a rewrite plan: the parts
that already work stay, the rest is added phase by phase.

## Stack

Next.js 15 (App Router) with React 19, TypeScript, Tailwind, Prisma on
PostgreSQL, Zod for input, nodemailer for mail. Docker Compose for local and
production, behind a Cloudflare tunnel. The brief asked for Drizzle and pnpm; we
kept Prisma and npm because the schema, migrations, import and deploy already run
on them and switching would only move working code around.

## Layout

| Path | What |
|---|---|
| `src/app/(public)/**` | Public site: home, agenda, archive, event and speaker pages |
| `src/app/(auth)/**`, `src/app/api/auth/**` | Login by Discord or email code |
| `src/app/api/**` | JSON routes: RSVP, iCal, check-in by slug, maintenance |
| `src/app/admin/**` | Organiser area: dashboard, events, registrations, check-in, members, audit log |
| `src/lib/**` | Domain logic. Pages and actions call into this, never into Prisma directly for writes |
| `src/lib/admin/**` | Organiser operations on events, registrations and roles |
| `src/lib/__checks__/**` | Scripts that run the logic against the local database (`npm run check:*`) |

## Decisions

### Authorisation lives on the server, in one place

`src/lib/auth.ts` holds `requireMember`, `requireOrganiser` and `requireAdmin`.
The role always comes from the database through the session cookie; nothing the
browser sends is trusted. The admin layout redirects or shows a 403, but that is
only the front door: every server action in `src/app/admin/actions.ts` checks the
role again, because a server action is an endpoint that can be called on its own.

Roles: `MEMBER`, `ORGANISER` (events, registrations, check-in) and `ADMIN`
(also roles, deleting events, and seeing email addresses). There is always at
least one admin; `setMemberRole` refuses to demote the last one.

### Mutations are server actions over domain functions

Admin mutations are server actions that validate with Zod and then call a
function in `src/lib/admin/**`. Those functions own the transaction and write
the audit entry inside it, so a change and its log line either both exist or
neither does. Public RSVP stays on the existing JSON routes.

### The waitlist has one implementation

Joining, leaving, raising capacity, cancelling on someone's behalf and admitting
from the waitlist all run in serializable transactions and reuse
`promoteFromWaitlist` and `renumberWaitlist` from `src/lib/rsvp.ts`. Raising
the capacity promotes people immediately. Lowering it never removes anyone.
An organiser can let someone in above capacity; that is logged.

### Check-in works by registration id

`checkInRsvp(rsvpId, ...)` is the single entry point. The phone screen at
`/admin/events/[id]/check-in` calls it with one tap, updates optimistically and
refreshes every 20 seconds so two people at the door stay in sync. A QR flow
can later put a signed token that resolves to the same `rsvpId` on the ticket
and call the same function. Checking in someone from the waitlist needs an
explicit "admit", so it is never an accident.

### Audit log

`AuditLog` stores actor, action (`event.create`, `rsvp.cancel`, `member.role`,
...), a readable summary and a small JSON payload with ids and changed field
names. It never stores email addresses or note fields. Plain check-ins are not
logged (there are dozens per evening); undoing one is.

### Time zones

The database stores UTC. Forms use `datetime-local` values that mean
Europe/Amsterdam, converted in `src/lib/time.ts` without extra dependencies,
including the days the clocks change.

### Known Next.js pitfall

A `loading.tsx` at the root of `/admin` broke client-side navigation between
admin pages (a `router.replace` to `/admin/events` silently did nothing). It was
removed. Deleting an event also does not call `revalidatePath`: that re-rendered
the now missing event page into a 404 before the client could navigate away.

## Roadmap from the brief

Done:

- Phase 3: admin dashboard, event create/edit/publish/unpublish/cancel/delete,
  registrations and waitlist management, mobile check-in, roles, audit log.

- Phase 4 (members): profiles on `/account`, opt-in public profiles on
  `/nerds` and `/nerds/[username]` with MVP/MCT badges, interests filter and
  attended meetups. Bios are plain text, not markdown, so members cannot embed
  images or links. LinkedIn and GitHub links must point at those domains.

Next, in order:

1. Sessions, sponsors and venues as their own tables (today: `Talk`, `Speaker`
   and venue fields on `Event`).
2. Blog with Markdown, and MinIO for avatars, event images and galleries.
3. Mail templates for the six transactional mails, including waitlist promotion
   (the promotion logic already returns who moved up).
4. Privacy: data export and account deletion from `/account`, audit log
   retention.
5. CSV import of historic events, alongside the existing meetup.com import.

Login stays Discord plus email code; Microsoft/Entra is not planned.
