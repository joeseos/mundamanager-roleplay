# Munda Manager Roleplay

A companion tool for Necromunda Roleplay.

## Stack

TanStack Start · Postgres + Drizzle · SSE for realtime · Docker → Coolify.
Supabase is used **only** as an identity provider.

## Local development

```sh
docker run -d --name nrp-postgres \
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=nrp \
  -p 5433:5432 postgres:17-alpine

cp .env.example .env.local     # then fill in the Supabase values
npm install
npm run db:migrate
npm run dev                    # http://localhost:3000
```

```sh
npm run typecheck
npm test
npm run db:generate            # after changing src/db/schema.ts
```

Tests run against a real Postgres rather than mocks, because the authorization
rule and the event-log transaction are the two things most worth getting right.

They truncate between cases, so they never touch the database you develop
against: `DATABASE_URL` is rewritten to a sibling `<name>_test` database, which
is created and migrated automatically on first run. There is nothing to
configure and nothing to remember.

## Auth

This app reuses the accounts in the Munda Manager Supabase project and shares
nothing else with it. No Supabase client runs on the server, no Supabase table
is read, and no RLS policy is involved.

```
browser                                  server
-------                                  ------
supabase.auth.signIn...
  └─ onAuthStateChange
     (SIGNED_IN | TOKEN_REFRESHED)
       └─ syncSession({ accessToken }) → verify with jose against the
                                          project's remote JWKS
                                          + iss + aud + ES256/RS256 only
                                        → upsert local users row
                                        → Set-Cookie (HttpOnly, Secure,
                                          SameSite=Lax, Max-Age = token exp)

every request                          → one global request middleware
  server fns AND the SSE stream          reads that cookie → context.user
```

Four things worth knowing:

- **The cookie exists because of SSE.** `EventSource` cannot set an
  `Authorization` header, so the token is mirrored into an HttpOnly cookie and
  the cookie becomes the single transport the server reads. One verification
  path for everything.
- **Verification is local.** `createRemoteJWKSet` caches the project's public
  keys in memory and refetches only on an unknown `kid`, so a request costs one
  signature check and one indexed lookup — no Supabase call. Nothing here ever
  calls `supabase.auth.getUser()` on the request path.
- **The sync runs on sign-in and token refresh only**, not per page load and
  not per action. A page load with a valid cookie costs nothing extra.
- **Exactly one of the other app's custom claims is read.** Munda Manager's
  access token hook injects a `user_profile` claim. `user_profile.username` is
  taken as a display string to seed a new local account — accounts there are
  email/password, so nothing else in the token carries a name. The rest of that
  claim (`user_role`, `patreon_tier_id`, `patreon_tier_title`,
  `patron_status`) is that app's authorization and entitlement model and is
  dropped: reading it would let Munda Manager decide what someone can do here.
  `readIdentity()` names the five fields this app accepts and never spreads the
  payload, so nothing else can leak in by construction. Every role here
  (arbitrator, player, admin) lives in this database.

Consequence, accepted deliberately: because verification is local, a session
revoked in Munda Manager stays valid here until the access token expires. That
project's expiry is **one hour**. Signing out of *this* app clears its cookie
and takes effect immediately. If a real kill switch is ever needed, the lever
is a flag on the local `users` row checked in the same middleware — effective
on the next request, and no round trip per request.

## Realtime

In-process fan-out, no broker: one `Map<sessionId, Set<listener>>`, sized for
3–6 people per table and an event every 20–30 seconds. Single instance by
design.

A mutation writes its derived state and its `session_events` row in one
transaction and emits **after** that transaction commits, never inside it — a
rollback must not leave clients showing state that never existed. Sequence
numbers come from a counter on the session row, so the row lock serialises
concurrent appends.

The log is for history, replay and transport. Derived state lives in normal
tables. This is not event sourcing.

Reconnection is the interesting part, because **neither side reliably notices
the other going away**:

- A page moved into Chrome's back-forward cache keeps its socket open, so the
  server sees no abort and no cancel, and its heartbeat keeps succeeding into a
  socket nobody reads. Handled with a `pagehide` handler, plus a hard cap on
  stream lifetime so an undetected leak is bounded by a timer rather than by
  correctly detecting every disconnect path.
- With the server killed, Chrome left `EventSource.readyState` at `OPEN` and
  never fired `error`. The client therefore runs a silence watchdog, and the
  heartbeat is a real `ping` event rather than a `: ping` comment, because
  EventSource never surfaces comment frames to JavaScript.

Every reconnect replays from the last `seq` the client saw, so a deploy — which
restarts the container and drops every open stream — is a non-event.

## Deployment

Push to `main` → CI runs typecheck, build and tests → Coolify's GitHub App
builds the image on the VPS and deploys it.

CI and the deploy are triggered by the same push and run independently, so a
failing test does **not** stop a deploy. CI also runs on pull requests, which
is where a break is meant to be caught.

Runtime environment variables (set in Coolify, not baked into the image):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | The Coolify-managed Postgres, by **internal hostname**. No public port. |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's legacy anon key is disabled, so this is the modern publishable key. |

Both Supabase values are public, and both are served to the browser by the root
loader **at runtime** rather than compiled into the client bundle, so one build
runs in any environment.

Coolify setup, done once by hand:

- The resource is a **GitHub App source** on this repo's `main`, build pack
  **Dockerfile**. The build pack is load-bearing: the Dockerfile's `CMD` runs
  the migrator before the server listens, and Nixpacks would start the server
  unmigrated while `/api/health` still answered 200.
- Healthcheck → `GET /api/health`. It returns 200 once the database answers;
  migrations run in a separate process before the server listens, so a server
  that can answer has already migrated.

Migrations run at container start via the programmatic Drizzle migrator, not
the `drizzle-kit` CLI, so the runtime image carries no build tooling — it holds
only `.output` and `drizzle`, and no `node_modules` at all. It reads the same
`drizzle/` folder and writes the same `__drizzle_migrations` journal, so
`npm run db:migrate` locally and the container are interchangeable. Single
instance, so no migration locking.

### Cloudflare

Cloudflare is a CDN in front of the origin; it does not run the app. Two rules
are configured there rather than in this repo, and nothing in the code enforces
them:

- **Cache Rule on `/` and `/login`** — eligible for cache, bypassing when the
  auth cookie is present. Cloudflare's cache key ignores `Cookie`, so without
  the bypass one visitor's signed-in page could be served to everyone. The
  origin says `private, no-store` on both `Cache-Control` and
  `CDN-Cache-Control` for a signed-in render, but a Cache Rule with an Edge TTL
  override ignores the former, which is why both are set.
- **Rate limit on the join-table server function** — a join code is six
  characters from a 32-character alphabet and nothing throttles guesses.

Bot Fight Mode is enabled, which is why the deploy runs through the Coolify
GitHub App rather than a webhook call from CI: it managed-challenges requests
from GitHub Actions runners.

## Layout

```
src/
  auth/          jose verification, cookie, local user upsert
  server/
    middleware.ts  the one place a request is authenticated
    authz.ts       the one place an access decision is made
    events.ts      the fan-out map
    appendEvent.ts the transaction + emit-after-commit boundary
    fn/            server functions — and ONLY server functions (see below)
  client/        supabase client, auth sync, the SSE hook
  routes/        pages, plus api/ for health and the SSE stream
```

Two rules worth not rediscovering the hard way:

- **A module under `src/server/fn/` must export only server functions.** Start
  strips server-function implementations from the client bundle, but any other
  export drags the whole module — and its `pg` import — into the browser, where
  it dies on `Buffer is not defined` and the page silently never hydrates.
  Shared server helpers go in `src/server/`.
- **`src/start.ts` opts out of automatic CSRF protection.** Defining that file
  at all disables it, so `createCsrfMiddleware()` is installed explicitly there.
