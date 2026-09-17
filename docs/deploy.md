# Deploy

The meetup platform runs on your own hardware: a Proxmox LXC with Docker, three
containers behind a Cloudflare tunnel. No monthly bill, which is the whole point
of moving off meetup.com.

Same shape as SmartRust, so if you have deployed that, this will look familiar.

## What runs where

```
Browser
  | https://modernnerdplace.nl
Cloudflare edge (TLS, DDoS)
  | tunnel
+-- Proxmox LXC, docker compose -----------------+
|                                                |
|  cloudflared  --> app (Next.js, :3000)         |
|                     |                          |
|                     v                          |
|                   postgres (:5432, internal)   |
+------------------------------------------------+
```

Three services, defined in `docker-compose.prod.yml`:

| Service | Image | Published port |
|---|---|---|
| `postgres` | `postgres:16.15-alpine` | none |
| `app` | built from `Dockerfile` | none |
| `cloudflared` | `cloudflare/cloudflared:2026.9.1` | none |

Nothing listens on the LAN. The tunnel dials out to Cloudflare, so the LXC needs
no inbound firewall rule and no public IP. If you ever need to poke at the app
from the box itself, uncomment the loopback port publish in
`docker-compose.prod.yml`.

The `app` container applies pending Prisma migrations on startup
(`prisma migrate deploy`) and then starts the Next.js server. That command is
idempotent: a restart with nothing pending does nothing.

## 1. Provision the LXC

On the Proxmox host:

```bash
bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/docker.sh)"
```

Choose Advanced, then Debian 12 or newer, unprivileged, 2 vCPU, 4 GB RAM, 20 GB
disk, root SSH enabled. Note the IP it prints.

The build runs on the box, so the disk fills with layers over time. Run
`docker system prune -af --filter "until=168h"` every few months, or copy the
weekly prune timer from the SmartRust repo (`deploy/docker-prune.*`).

## 2. Create the Cloudflare tunnel

In Cloudflare Zero Trust, Networks, Tunnels:

1. Create a tunnel named `modernnerdplace`.
2. On the Install connector screen, copy the value behind `--token`. That is
   `CLOUDFLARE_TUNNEL_TOKEN` below. Treat it as a password: it is enough to
   impersonate the tunnel.
3. On the Public Hostname tab, add exactly one entry:

   | Subdomain | Domain | Path | Service |
   |---|---|---|---|
   | *(empty)* | modernnerdplace.nl | *(empty)* | `http://app:3000` |

   `app` is the compose service name. It resolves because `cloudflared` runs in
   the same compose network, which means there is no LAN IP to keep in sync when
   the LXC moves.

4. Add a second hostname for `www` pointing at the same service if you want
   `www.modernnerdplace.nl` to work.

Cloudflare creates the DNS record for you. `modernnerdplace.nl` is currently a
redirect to meetup.com, so remove that redirect rule in the same zone or the
tunnel hostname will never be reached.

## 3. Clone and configure

```bash
ssh root@<lxc-ip>
apt-get update && apt-get install -y git
mkdir -p /opt && cd /opt
git clone <repo-url> meetups
cd meetups
cp .env.example .env
```

The repo is private, so use an SSH deploy key: `ssh-keygen -t ed25519` on the
LXC, paste the public key under the repo's Settings, Deploy keys, then clone
with the SSH URL.

Generate the database password:

```bash
openssl rand -base64 32
```

## 4. Environment variables

Everything lives in `/opt/meetups/.env`. That file is in `.gitignore` and must
stay out of the repo. Compose reads it automatically for both
`docker-compose.yml` and `docker-compose.prod.yml`.

The production stack refuses to start when one of the required values is
missing, with a message naming the variable.

| Variable | Required | What it is |
|---|---|---|
| `POSTGRES_USER` | yes | Database user, for example `mnp`. |
| `POSTGRES_PASSWORD` | yes | Database password. Generate it, do not type one. |
| `POSTGRES_DB` | yes | Database name, for example `mnp`. |
| `APP_TAG` | yes | Version tag for the app image, for example `2026-09-18` or the short commit sha. Bump it every deploy. |
| `APP_IMAGE` | no | Image name, defaults to `mnp-meetups`. Only change this if you push to a registry. |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://modernnerdplace.nl`. Baked into the browser bundle at build time, so changing it needs a rebuild, not a restart. |
| `CLOUDFLARE_TUNNEL_TOKEN` | yes | Token from step 2. |
| `DISCORD_CLIENT_ID` | no | Discord OAuth app id. Unset means no Discord login. |
| `DISCORD_CLIENT_SECRET` | no | Discord OAuth secret. |
| `SMTP_HOST` | no | Mail server for login codes and confirmations. Unset means no mail goes out, which also means nobody can log in by email. |
| `SMTP_PORT` | no | Defaults to `587`. |
| `SMTP_USER` | no | SMTP user. |
| `SMTP_PASS` | no | SMTP password. |
| `MAIL_FROM` | no | Sender, defaults to `Modern Nerdplace <hello@modernnerdplace.nl>`. |

`DATABASE_URL` is not in `.env` for production: compose builds it from the three
Postgres values and points it at the `postgres` service. You only set
`DATABASE_URL` yourself for local development, where the database runs on
localhost.

For the Discord app, register the redirect URI
`https://modernnerdplace.nl/api/auth/discord/callback` under OAuth2, General.

After editing, check that nothing is left at a placeholder:

```bash
grep -n 'changeme\|REPLACE' .env    # should print nothing
```

## 5. First start

Snapshot the LXC from the Proxmox host first. That snapshot is the rollback
plan if a migration goes wrong.

```bash
cd /opt/meetups
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

Expect the Prisma migration output first (`X migrations found`, then
`Applying migration ...`), then the Next.js startup line. The first build takes
several minutes; later builds reuse the npm cache layer.

## 6. Verify

```bash
# On the box, straight at the container
docker compose -f docker-compose.prod.yml ps
# app should say (healthy), not just (running)

# Tunnel registered with the edge
docker compose -f docker-compose.prod.yml logs cloudflared | grep -i "registered tunnel connection"

# From anywhere
curl -sI https://modernnerdplace.nl
```

If `app` stays `(starting)` for more than a minute, read its log. The usual
cause is a migration that cannot apply, not the web server.

## 7. Make yourself organiser

There is no admin bootstrap screen. The `Member.role` column decides who is an
organiser, and the row only exists once you have logged in.

1. Open `https://modernnerdplace.nl` and log in once, by Discord or by email
   code. That creates your `Member` row.
2. Flip the role:

```bash
cd /opt/meetups
source .env
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "UPDATE \"Member\" SET role = 'ORGANISER' WHERE email = 'fabio@vdburg.it';"
```

It should print `UPDATE 1`. If it prints `UPDATE 0` the email does not match;
check what is actually stored:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, email, name, role FROM \"Member\" ORDER BY \"createdAt\";"
```

3. Log out and back in, so the session picks up the new role.

Same command with `'MEMBER'` takes the role away again.

## 8. Backup

The data lives in the `postgres-data` volume. A snapshot of the LXC covers it,
but a plain SQL dump is smaller, restores anywhere, and can be read by a human.

One backup:

```bash
cd /opt/meetups
source .env
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "/var/backups/meetups-$(date +%F).sql.gz"
```

Nightly, via cron on the LXC (`crontab -e`):

```cron
15 3 * * * cd /opt/meetups && set -a && . ./.env && set +a && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > /var/backups/meetups-$(date +\%F).sql.gz && find /var/backups -name 'meetups-*.sql.gz' -mtime +30 -delete
```

Note the escaped `\%` in the date: cron treats a bare `%` as a newline.

A backup that only sits on the same LXC is not a backup. Copy `/var/backups`
off the box, to the Proxmox host or wherever your other backups go.

## 9. Restore

This overwrites the current database. Make a dump of the current state first,
even when you are sure.

```bash
cd /opt/meetups
source .env

# Stop the app so nothing writes while you restore. Leave postgres running.
docker compose -f docker-compose.prod.yml stop app

gunzip -c /var/backups/meetups-2026-09-18.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

docker compose -f docker-compose.prod.yml start app
```

The dump was made with `--clean --if-exists`, so it drops the existing tables
itself. `psql` prints notices about objects that do not exist; those are
expected on a restore into an empty database.

Check the result before you walk away:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT (SELECT count(*) FROM \"Member\") AS members, (SELECT count(*) FROM \"Event\") AS events, (SELECT count(*) FROM \"Rsvp\") AS rsvps;"
```

If the dump came from an older version of the schema, start the app afterwards
and let `prisma migrate deploy` bring it forward. Check `_prisma_migrations` if
you want to see where it stands.

## 10. Updating

```bash
cd /opt/meetups
git pull
$EDITOR .env                 # bump APP_TAG
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

Snapshot the LXC before a deploy that carries a migration. Rolling a migration
back by hand is much more work than restoring a snapshot.

To go back to the previous version: set `APP_TAG` to the old tag and run
`docker compose -f docker-compose.prod.yml up -d` without `--build`. That only
works if the old image is still on the box, and it does not undo a migration
that already ran.

## 11. Day to day

| Action | Command (from `/opt/meetups`) |
|---|---|
| Status | `docker compose -f docker-compose.prod.yml ps` |
| App log | `docker compose -f docker-compose.prod.yml logs -f app` |
| Tunnel log | `docker compose -f docker-compose.prod.yml logs -f cloudflared` |
| Database shell | `source .env && docker compose -f docker-compose.prod.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"` |
| Restart one service | `docker compose -f docker-compose.prod.yml restart app` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` (keeps the volume) |
| Reclaim disk | `docker system prune -af --filter "until=168h"` |

`docker compose down -v` deletes the database volume. There is no undo.

## 12. Importing the meetup.com history

The import script runs with `tsx`, which is a dev dependency and not in the
runtime image. Run it from a checkout with `DATABASE_URL` pointed at production:

```bash
cd /opt/meetups
npm ci                       # needs node 20 on the LXC, or run it from your laptop
source .env
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB?schema=public" \
  npm run import:meetup
```

Postgres publishes no port in production, so temporarily uncomment the loopback
port publish in `docker-compose.prod.yml`, or run the import through
`docker compose exec postgres psql`. Comment the port back out afterwards.

Take a backup before the import. It writes to the same tables the site serves.

## 13. When something is wrong

| Symptom | Where to look |
|---|---|
| Site shows Cloudflare error 1033 | `cloudflared` log. Is the tunnel registered, and does the Public Hostname point at `http://app:3000`? |
| Site shows 502 | The app container. `docker compose ... ps` and its log. |
| Still redirected to meetup.com | The old redirect rule in the Cloudflare zone is still active. |
| App restarts in a loop | Its log. Almost always `prisma migrate deploy` failing, or the database not up. |
| `postgres` unhealthy | `docker compose ... logs postgres`. A full disk is the usual cause. |
| Login mails do not arrive | The `SMTP_*` values. Unset means the app sends nothing at all. |
| Build fails on `.next/standalone is missing` | `next.config.mjs` lost its `output: "standalone"` line. |
| Build fails on disk space | `docker system prune -af` and check `df -h`. |

## Local development

Not the deploy, but you will want it in the same place.

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:migrate
npm run dev
```

To check the production image locally instead, `docker compose up -d --build`
starts the app container and the database together. That is the path to use when
you are changing the `Dockerfile`, because a broken image fails here and not on
the LXC.
