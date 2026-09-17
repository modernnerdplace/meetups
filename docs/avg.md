# Personal data (AVG / GDPR)

Running the meetups yourself instead of on meetup.com means the responsibility
for the attendee data moves to you. Meetup.com was the party holding it; from
now on that is Modern Nerdplace. This page lists what the system stores, why,
and what you still have to decide. It is an inventory and a checklist, not legal
advice.

## What is stored

Taken from `prisma/schema.prisma`, which is the source of truth.

| Where | Field | What it is | Why it is there |
|---|---|---|---|
| `Member` | `name` | Name as entered | Attendee list, name badge, speaker credit |
| `Member` | `email` | Email address | Login by code, confirmations, practical mail about an event |
| `Member` | `emailVerified` | Moment the address was confirmed | Shows the address really belongs to the member |
| `Member` | `discordId` | Discord account id | Alternative login, link to the community |
| `Member` | `avatarUrl` | Link to a profile picture | Shown next to the name, usually comes from Discord |
| `Member` | `company` | Employer, optional | Who is in the room, useful for the host |
| `Member` | `notes` | Free text, organisers only | Standing remarks about a person, for example an allergy |
| `Member` | `role` | `MEMBER` or `ORGANISER` | Decides who sees the organiser views |
| `AuthSession` | `token`, `expiresAt` | Session token | Keeps someone logged in |
| `LoginToken` | `email`, `token`, `expiresAt`, `usedAt` | One time login code | Logging in by email |
| `Rsvp` | `status`, `waitlistPosition` | Signed up, waitlist, cancelled | Seat count and waitlist |
| `Rsvp` | `note` | Free text from the member | Dietary wish or a practical remark for this event |
| `Rsvp` | `checkedInAt` | Moment of check in | Attendance, so you know who actually showed up |
| `Speaker` | `name`, `bio`, `avatarUrl`, `links` | Speaker profile | Public speaker page and the programme |
| `Event` | `importedAttendees` | Attendee count from meetup.com | Historical number only, no names |

The `Rsvp.note` and `Member.notes` fields are free text. In practice people fill
in things like "vegetarian", "gluten free", "I come by wheelchair" or "I will be
half an hour late". A dietary wish or an accessibility need can say something
about health or religion, and under the AVG that is a special category of
personal data with stricter rules than a name and an email address. Both fields
are visible to organisers only; that is a deliberate choice in the schema and it
should stay that way.

Data that exists without being in the schema:

- **Access logs.** The Next.js container and Cloudflare both log requests, which
  includes IP addresses. Cloudflare keeps its own logs under its own retention.
- **Backups.** The nightly dump from `docs/deploy.md` contains everything above,
  including the note fields. A deletion request is not fully handled until the
  backups holding that person have aged out.
- **Mail.** Whatever SMTP provider you configure sees the address and the
  content of every login code and confirmation.
- **Discord.** Logging in with Discord means Discord sees that the account
  logged in to this site.

## What is not stored

No payment details, no postal address, no phone number, no date of birth, and no
tracking or analytics beyond the plain server log. Meetup.com held more than
this, so the move is a reduction.

## How long it is kept

Nothing deletes itself today. `AuthSession` and `LoginToken` carry an
`expiresAt`, but an expired row stays in the table until something removes it.
Members, RSVPs, notes and check ins are kept until they are deleted by hand.

That is the largest open item on this page.

## What you have to decide

1. **Retention.** How long do RSVPs, check ins and note fields stay after an
   event? A common choice is to clear the note fields shortly after the event,
   because a dietary wish is only useful up to the catering order, and to keep
   the attendance figure without the names. Whatever you pick, write it down and
   then have the system enforce it, otherwise it stays theory.
2. **Clean up expired rows.** `AuthSession` and `LoginToken` rows past their
   `expiresAt` have no purpose. A scheduled delete is the simplest fix and it
   also shrinks the backup.
3. **Privacy statement.** A page on the site saying who is responsible, what is
   collected, why, how long, who it is shared with (Cloudflare, your mail
   provider, Discord), and where to send a request. Include a contact address
   that you actually read.
4. **Requests for access and deletion.** Decide who handles them and how. With
   the current setup that is SQL by hand. If you expect more than an occasional
   request, an organiser button for "export this member" and "delete this
   member" saves you every time.
5. **Backups.** How long you keep them, where they are stored, and whether they
   are encrypted. A dump on a shared drive is the same data as the database.
6. **Processors.** Cloudflare and your mail provider process this data on your
   behalf. Check whether you need a processing agreement with each of them, and
   whether the data leaves the EU. Cloudflare and most mail providers publish a
   standard agreement.
7. **Who is an organiser.** Organisers see the note fields, so the `ORGANISER`
   role is the real access control. Keep the list short and review it once a
   year.
8. **What goes public.** Decide whether attendee names are visible to everyone,
   only to people who are signed up, or only to organisers. Speaker pages are
   public by design; an attendee list is a different question.
9. **Free text.** You can steer what lands in the note fields by what the form
   asks. A question phrased as "anything we should know for the catering" gets
   different answers than an open remark box. This is the cheapest way to keep
   sensitive data out of the database in the first place.

## Practical points for self hosting

- The data sits on your own LXC. Physical and host security is now yours: disk
  encryption, who can reach the Proxmox host, who has the SSH key.
- `.env` holds the database password and the tunnel token. It stays out of the
  repo and off any shared drive.
- The database publishes no port and is reachable only from the app container.
  Keep it that way.
- A data breach, for example a leaked dump or an account takeover, has to be
  assessed and possibly reported to the Autoriteit Persoonsgegevens within 72
  hours. Knowing in advance who makes that call saves a bad evening.
- Meetup.com stays in the picture as long as the history import keeps a copy
  there. Closing that account is also a decision about their copy of the data.
