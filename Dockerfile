# syntax=docker/dockerfile:1.7
#
# Modern Nerdplace meetup platform: production image.
#
# Next.js 15 App Router in standalone output mode, so the runtime layer only
# carries the node_modules the server actually touches instead of the whole
# install. Prisma client is generated during the build; pending migrations are
# applied when the container starts.
#
#   docker build -t mnp-meetups:dev .
#
# REQUIREMENT: next.config.mjs must contain `output: "standalone"`. Without it
# `next build` writes no .next/standalone folder and the build below stops with
# an explicit error.

ARG NODE_IMAGE=node:20.20.2-alpine


# ── base ──────────────────────────────────────────────────────────────────
# openssl: the Prisma query engine and schema engine link against it.
# libc6-compat: glibc shim the Prisma engines expect on musl.
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# ── deps: full install (dev deps included, we need the Prisma CLI) ────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund


# ── builder: prisma generate + next build ────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# the public URL has to be known here and not just at runtime.
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# No database during the build. Prisma Client refuses to construct without a
# DATABASE_URL, so give it a syntactically valid one that points nowhere. Any
# page that really queries the database at build time has to be dynamic.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV NODE_ENV=production

# npm run build = prisma generate && next build
RUN npm run build

# Fail loudly instead of producing a broken runtime layer.
RUN test -d .next/standalone || { \
      echo "ERROR: .next/standalone is missing. Add output: \"standalone\" to next.config.mjs." >&2; \
      exit 1; \
    }

# server.js serves ./public itself once we copy it next to it, but the folder
# does not have to exist in the repo.
RUN mkdir -p public


# ── runner ────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHECKPOINT_DISABLE=1

# CHECKPOINT_DISABLE keeps the Prisma CLI from phoning home for a version
# check on every container start.

# `node` (uid 1000) ships with the image. .next has to be writable because
# Next.js writes the prerender/ISR cache there at runtime.
RUN mkdir -p /app/.next && chown -R node:node /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# The Prisma CLI is a dev dependency and therefore not part of the traced
# standalone output, but we need it for `migrate deploy` on startup. `prisma`
# only depends on `@prisma/engines`, so these three directories are the whole
# closure. .prisma/client also carries the query engine binary, which output
# tracing does not reliably pick up.
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000

# Answers as soon as the server responds at all. A 404 is fine here: it still
# proves the process is up, which is what the tunnel waits for.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

# Apply pending migrations, then hand PID 1 to the Next.js server. `migrate
# deploy` is idempotent, so a restart with nothing pending is a no-op.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node server.js"]
