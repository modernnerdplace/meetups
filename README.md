# Modern Nerdplace meetups

Our own meetup platform, replacing meetup.com. Events, sign ups, waitlist,
speakers and the history of everything we did before. Runs on
`modernnerdplace.nl`, on our own hardware, for the cost of the electricity.

Next.js 15 with the App Router, React 19, TypeScript, Tailwind, Prisma on
PostgreSQL. Node 20.

## Running it locally

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:migrate
npm run dev
```

The site is then on <http://localhost:3000>. The database runs in Docker on
`127.0.0.1:5432`; everything else runs on the host, so hot reload works
normally.

To check the production image instead, `docker compose up -d --build` starts the
app container and the database together. Do that whenever you touch the
`Dockerfile`.

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `prisma generate` plus `next build` |
| `npm run prisma:migrate` | Create and apply a migration locally |
| `npm run prisma:studio` | Browse the database |
| `npm run seed` | Seed data |
| `npm run import:meetup` | Import the meetup.com history |

## Where the rest is

- [`docs/deploy.md`](docs/deploy.md) how it runs in production: Proxmox LXC,
  docker compose, Cloudflare tunnel, backup and restore, first organiser.
- [`docs/avg.md`](docs/avg.md) which personal data this stores, and what still
  needs deciding now that we host it ourselves.
- [`AGENTS.md`](AGENTS.md) conventions, and who owns which files.
- [`prisma/schema.prisma`](prisma/schema.prisma) the data model, and the
  contract between all the parts.

CI runs the typecheck and the build on every push to `main` and on every pull
request, without a database.
