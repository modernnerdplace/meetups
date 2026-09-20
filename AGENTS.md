# Modern Nerdplace meetup platform

Eigen meetupsysteem voor Modern Nerdplace, als vervanging van meetup.com. Draait straks
op `modernnerdplace.nl` (dat domein is nu nog een redirect naar meetup.com).

## Stack

Next.js 15 (App Router) met React 19, TypeScript, Tailwind, Prisma op PostgreSQL.
Zelfde keuzes als SmartRust, zodat de deploy hetzelfde werkt: docker compose op een
Proxmox-LXC, achter een Cloudflare tunnel. Node 20.

## Bron van waarheid

`prisma/schema.prisma` is het contract tussen alle onderdelen. Wijzig het niet zomaar:
de import van de historie, de aanmeldingen en de publieke pagina's leunen er alle drie op.
Moet er iets bij, meld dat in je rapport in plaats van het stil aan te passen.

## Wie welke bestanden bezit

Er werken meerdere agents tegelijk in deze repo. Blijf binnen je eigen paden.

| Onderdeel | Paden |
|---|---|
| Import van de meetup.com-historie | `scripts/import-meetup-history.ts`, `data/**`, `prisma/seed.ts` |
| Aanmeldingen, inloggen, wachtlijst | `src/lib/**`, `src/app/api/**`, `src/app/(auth)/**` |
| Publieke pagina's | `src/app/(public)/**`, `src/components/**`, `src/app/globals.css` |
| Deploy en infra | `Dockerfile`, `docker-compose*.yml`, `.github/**`, `docs/**` |
| Beheer (admin, check-in, auditlog) | `src/app/admin/**`, `src/lib/admin/**`, `src/lib/audit.ts`, `src/lib/time.ts` |

`src/app/layout.tsx`, `package.json` en `prisma/schema.prisma` zijn gedeeld: raak ze alleen
aan als het echt moet, en zeg het in je rapport.

## Afspraken

- Geen geheimen in de repo. Alles via environment variables, zie `.env.example`.
- Persoonsgegevens blijven minimaal: naam, e-mail, optioneel bedrijf en een opmerkingveld.
  Het opmerkingveld kan een dieetwens bevatten en is dus alleen zichtbaar voor organisatoren.
- Datums altijd in UTC in de database, weergeven in Europe/Amsterdam.
- Schrijf in het Engels in de code en de UI. Commentaar mag Nederlands.

## Schrijfstijl in de UI

Fabio wil niet dat zijn publieke werk eruitziet als AI-tekst. Dus: geen gedachtestrepen
(— of –), geen rijtjes van drie bijvoeglijke naamwoorden, geen "not just X but Y", en geen
woorden als seamless, robust, leverage, empower, elevate, unlock, delve. Kort, concreet,
en met hooguit een emoji per blok.

## Commits

Boodschap in het Engels, met een voorvoegsel zoals `feat:`, `fix:`, `data:` of `docs:`.
Commit met expliciete paden. Zet er nooit een Co-Authored-By-regel of andere AI-verwijzing
in; dat is een harde regel.
