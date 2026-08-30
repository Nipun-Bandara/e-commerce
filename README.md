# ecom

An e-commerce storefront built with Next.js, Prisma and PostgreSQL. Prices are in LKR.

**Status: foundation only.** This repository contains the project scaffold, the complete
database schema, seed data and the conventions doc. There are no user-facing features
yet — no authentication, cart, product pages, checkout or admin. The home page is still
the Next.js default.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) with TypeScript in strict mode
- [Tailwind CSS 4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) (Radix primitives, `radix-nova` style)
- [Prisma 7](https://www.prisma.io) with PostgreSQL 16
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

Then set `DATABASE_URL`. The default in `.env.example` matches the Docker command above.

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

## Conventions

[CLAUDE.md](CLAUDE.md) is the full conventions document: folder responsibilities, naming
rules, the Decimal rule, the "data access lives in `src/server/`" rule, and the Prisma 7
specifics that differ from most tutorials. Read it before adding code.
