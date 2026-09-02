# ecom

An e-commerce storefront built with Next.js, Prisma and PostgreSQL. Prices are in LKR.

**Status: in progress.** The catalogue, search and filters, the cart, authentication,
checkout, orders, the admin screens and PayHere payments are built.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) with TypeScript in strict mode
- [Tailwind CSS 4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) (Radix primitives, `radix-nova` style)
- [Prisma 7](https://www.prisma.io) with PostgreSQL 16
- [Auth.js](https://authjs.dev) (NextAuth v5) — email and password, JWT sessions
- pnpm

## Requirements

- Node.js 20 or newer
- pnpm 11 (`corepack enable pnpm`)
- A PostgreSQL 16 database

## Setup

**1. Install dependencies**

```bash
pnpm install
```

This also runs `prisma generate`, which writes the typed client to `src/generated/prisma/`.

**2. Start a database**

Any PostgreSQL 16 instance works. For a throwaway local one:

```bash
docker run -d --name ecom-postgres -e POSTGRES_USER=ecom -e POSTGRES_PASSWORD=ecom -e POSTGRES_DB=ecom -p 5433:5432 postgres:16-alpine
```

Port 5433 avoids colliding with a Postgres already running on 5432.

**3. Configure the environment**

```bash
cp .env.example .env
```

Then set `DATABASE_URL` — the default in `.env.example` matches the Docker command above —
and `AUTH_SECRET`, which signs the session cookie. Generate one with:

```bash
openssl rand -base64 32
```

**4. Create the schema**

```bash
pnpm db:migrate
```

**5. Load sample data**

```bash
pnpm db:seed
```

Inserts 5 categories, 30 products with placeholder images, and 3 users. The script is
idempotent — running it again is safe and changes nothing.

Seeded accounts have real bcrypt password hashes, so you can sign in with them:

| Email | Password | Role |
| --- | --- | --- |
| `admin@ecom.lk` | `admin-password` | `ADMIN` |
| `amara@example.com` | `user-password` | `USER` |
| `dinuka@example.com` | `user-password` | `USER` |

These are development credentials and are re-written on every seed. Seeded data does not
belong in a deployed database.

**6. Run the app**

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm db:migrate` | Create and apply a migration from schema changes |
| `pnpm db:deploy` | Apply existing migrations (production) |
| `pnpm db:reset` | Drop, re-migrate and re-seed. **Destroys data** |
| `pnpm db:seed` | Run `prisma/seed.ts` |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:studio` | Browse the data in Prisma Studio |

`pnpm db:studio` picks a random port by default; pass `--port 5555` for a stable URL.

## Project layout

```
prisma/          schema.prisma, migrations, seed.ts
src/app/         routes
src/components/  shared app components
src/components/ui/  shadcn/ui primitives
src/lib/         utilities — Prisma singleton, money helpers
src/server/      data access functions (all database queries)
```

## Data model

`User`, `Address`, `Category`, `Product`, `ProductImage`, `Cart`, `CartItem`, `Order`,
`OrderItem`. Two enums: `Role` and `OrderStatus`.

Two things to know before writing queries:

- **All money is `Decimal @db.Decimal(10, 2)`, never a float.** Use the helpers in
  `src/lib/money.ts`.
- **`OrderItem` snapshots `productName` and `unitPrice`**, and `Order` snapshots the
  shipping address. Historical orders read those columns, never the live `Product` or
  `Address` row, so a rename, reprice or delete cannot rewrite history.

## Authentication

Email and password via Auth.js with the Credentials provider. Sessions are JWTs in an
httpOnly cookie — the strategy Credentials requires — carrying the user's id and role.

- Sign up at `/register`, sign in at `/login`. Both validate with Zod **on the server**;
  the browser's `required` and `type="email"` are only there to save a round trip.
- Passwords are hashed with bcrypt at cost 12, in `src/server/users.ts`. Nothing else
  reads or writes a hash.
- A cart filled as a guest is merged into the account on sign-in — quantities for the
  same product are added together and clamped to stock. See `mergeGuestCart` in
  `src/server/cart.ts`.
- `src/proxy.ts` (Next 16's renamed Middleware) redirects unauthenticated visitors away
  from `/account/*` and `/admin/*` to `/login?callbackUrl=…`. It is an optimistic check:
  the real gate is `requireAuth()` / `requireAdmin()` in `src/server/auth.ts`, which
  every protected page calls. A signed-in non-admin who opens `/admin` gets a 403 page,
  not a redirect.

## Payments

Checkout hands off to [PayHere](https://www.payhere.lk), in sandbox mode by default.
`createOrder` writes the order as `PENDING` and commits its stock; the gateway decides
what happens next.

```
/checkout  ──▶ order created (PENDING, stock held)
           ──▶ /checkout/pay/[orderNumber]   signed form POSTed to PayHere
                     │
   PayHere ──────────┼──────────▶ browser: /checkout/success/[orderNumber]
                     │                      or /checkout/cancelled/[orderNumber]
                     └──────────▶ server:  POST /api/payments/payhere/notify
                                           ── the only writer of PAID ──
```

**The return URL is not proof of payment.** Anyone can type
`/checkout/success/ORD-…`, so that page only ever *reads* `Order.status`. The signed
server-to-server callback at `/api/payments/payhere/notify` is what changes it, and it
verifies the `md5sig` checksum with the merchant secret, checks the amount and currency
against the stored total, and refuses anything that does not match with a `400`.

- **Idempotent.** PayHere retries. Both status changes are conditional updates on
  `status = PENDING`, so a repeated notification matches no row and does nothing.
- **Never backwards.** The same condition is what stops a late `cancelled` undoing a
  payment, or a `success` reviving a cancelled order.
- **Stock comes back exactly once.** Restoration runs inside the branch that won that
  conditional update, and nowhere else.

Configuration lives in [`src/lib/payhere.ts`](src/lib/payhere.ts) — the endpoint switch,
both hash formulas and the status-code table. `PAYHERE_SANDBOX` picks the endpoint;
anything but the exact string `false` means sandbox. The module is `server-only`, so
`PAYHERE_MERCHANT_SECRET` cannot reach the browser bundle.

Set `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` from a
[sandbox merchant account](https://sandbox.payhere.lk) to enable payments. Without them
the app still builds and runs — the payment step says payments are not configured.

Test cards are published in PayHere's
[Sandbox & Testing guide](https://support.payhere.lk/sandbox-and-testing). `4916217501611292`
(Visa) pays successfully and `4024007194349121` (Visa) declines for insufficient funds,
which is the one to use for checking that stock comes back. Name, CVV and expiry can be
any valid values.

### Testing the webhook locally

PayHere calls `notify_url` from its own servers and cannot reach `localhost`, so a
payment made against a local dev server will redirect the browser back but never mark
the order `PAID`. Expose the app on a public URL to test the full round trip.

**1. Start the dev server**

```bash
pnpm dev
```

**2. Open a tunnel to port 3000**

With [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Or with a [Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/), which needs no account:

```bash
cloudflared tunnel --url http://localhost:3000
```

Both print a public HTTPS URL, e.g. `https://oddly-named-thing.ngrok-free.app`.

**3. Point the app at the tunnel**

`NEXT_PUBLIC_APP_URL` is what the return, cancel and notify URLs are built from, so it
has to be the tunnel URL while testing — with `localhost` in it, PayHere has nothing to
call back to:

```bash
NEXT_PUBLIC_APP_URL="https://oddly-named-thing.ngrok-free.app"
```

Restart `pnpm dev` after changing it. Add the same domain under **Settings → Domains &
Credentials** in the PayHere sandbox dashboard, or the merchant secret will not
authorise payments from it. Tunnel URLs change every restart on the free tiers, so both
of these have to be redone each session.

**4. Watch it land**

Pay with a sandbox card. The `POST /api/payments/payhere/notify` shows up in the tunnel's
request inspector and in the dev server output, and the order moves to `PAID` — the
confirmation page's "we are confirming your payment" state resolves on its own within a
few seconds.

Set `NEXT_PUBLIC_APP_URL` back to `http://localhost:3000` when you are done.

## Conventions

[CLAUDE.md](CLAUDE.md) is the full conventions document: folder responsibilities, naming
rules, the Decimal rule, the "data access lives in `src/server/`" rule, and the Prisma 7
specifics that differ from most tutorials. Read it before adding code.
