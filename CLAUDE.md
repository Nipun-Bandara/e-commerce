@AGENTS.md

# ecom

An e-commerce storefront. This repository currently contains the **foundation only**:
scaffold, database schema, seed data and conventions. There are no user-facing features
yet — no auth, no cart UI, no product pages, no checkout, no admin. The home page is
still the Next.js default.

---

## Stack

| Piece | Version | Why |
| --- | --- | --- |
| **Next.js (App Router)** | 16.3.3 | Server Components let data access stay on the server, so product and order queries never ship to the browser. App Router is the supported path for new apps; Pages Router is legacy. |
| **TypeScript (strict)** | 5.9 | `strict: true` is on. Money, stock and order status are exactly the things you want the compiler checking. |
| **Tailwind CSS** | 4.3 | Utility CSS keeps styling next to markup, so there is no parallel stylesheet to keep in sync. v4 configures itself from `src/app/globals.css` — there is no `tailwind.config.js`. |
| **shadcn/ui** | `radix-nova` style | Components are copied into `src/components/ui/` as source we own and can edit, rather than a dependency we have to fight. Built on Radix primitives, so keyboard and screen-reader behaviour is handled. |
| **Prisma ORM** | 7.10 | Typed queries generated from one schema file, plus real migration history. The generated types are what make "a price is a Decimal" enforceable at compile time. |
| **PostgreSQL** | 16 | `numeric(10, 2)` gives exact money. Also gives real foreign keys, partial-unique behaviour on nullable columns, and transactions for checkout later. |
| **pnpm** | 11.24 | Fast, strict about phantom dependencies, and the lockfile is committed. |

Prisma is pinned to **7.10.0** on purpose. At the time of setup the npm `latest` tag
pointed at `8.0.0-rc.12`, a release candidate. Do not run `pnpm up prisma` without
reading the v8 upgrade guide first — pin both `prisma` and `@prisma/client` to the same
version.

### Prisma 7 specifics worth knowing

These differ from most Prisma tutorials, which describe v5/v6:

- **Config lives in `prisma7.config.ts`**, not in `schema.prisma`. The `datasource`
  block has no `url` — the connection string is read from `DATABASE_URL` in the config
  file, which is also where the seed command is registered.
- **The client is generated into `src/generated/prisma/`** (git-ignored), not into
  `node_modules`. Import it as `@/generated/prisma/client`. Run `pnpm db:generate`
  after any schema change; `postinstall` also runs it.
- **Queries go through a driver adapter** (`@prisma/adapter-pg`), not a bundled query
  engine binary. That is why `src/lib/prisma.ts` constructs `PrismaPg` explicitly.

---

## Folder structure

```
prisma/
  schema.prisma       Single source of truth for the data model
  migrations/         Generated SQL migration history — committed, never edited by hand
  seed.ts             Idempotent development seed

src/
  app/                Routes only: page.tsx, layout.tsx, route.ts, loading/error boundaries
  components/         Shared app components (product card, header, …)
  components/ui/      shadcn/ui primitives — added via the CLI, ours to edit
  lib/                Framework-agnostic utilities: prisma singleton, money helpers, cn()
  server/             Data access. Every database query lives here
  generated/prisma/   Generated Prisma client — git-ignored, never edited
```

What belongs where:

- **`src/app/`** — routing and composition. Pages fetch by calling `src/server/`
  functions and render. No `prisma` import, no SQL, no business rules.
- **`src/components/`** — presentational and interactive components specific to this
  store. A component receives data as props; it does not fetch.
- **`src/components/ui/`** — generic, product-agnostic primitives from shadcn. Add with
  `pnpm dlx shadcn@latest add <name>`. Edit freely, but keep them free of store logic.
- **`src/lib/`** — pure helpers with no knowledge of routes or the database schema.
  `prisma.ts` (the client singleton) and `money.ts` are the exceptions and are
  deliberately the only stateful things here.
- **`src/server/`** — one module per aggregate (`products.ts`, `categories.ts`, later
  `orders.ts`, `cart.ts`). Exports named functions that take plain arguments and return
  typed rows.

---

## Conventions

### Files and folders

- Directories and non-component files: **kebab-case** — `order-summary.ts`, `src/server/products.ts`.
- Component files: **kebab-case**, default export named in **PascalCase** —
  `product-card.tsx` exports `ProductCard`.
- Route folders follow Next conventions: `app/products/[slug]/page.tsx`.
- Data access functions read as verbs: `listActiveProducts`, `getProductBySlug`,
  `createOrder`. `list*` returns an array, `get*` returns one row or `null`.

### Database

- Model names are **PascalCase singular** — `Product`, `OrderItem`.
- Fields are **camelCase** — `categoryId`, `shippingPostalCode`, `isDefault`.
- Primary keys are `id`, a cuid string. Foreign keys are `<model>Id`.
- Booleans read as assertions: `isActive`, `isDefault`.
- Timestamps are `createdAt` / `updatedAt`.
- Enum members are **SCREAMING_SNAKE_CASE** — `PENDING`, `ADMIN`.

### Indexes

Indexes declared in the schema are the ones that do work. Two obvious-looking indexes
are **deliberately absent**, because Postgres already covers those lookups and a second
index would only cost writes:

- `Product.slug` — `@unique` already creates the btree index that slug lookups use.
- `CartItem.cartId` — the `@@unique([cartId, productId])` composite is a btree with
  `cartId` as its leading column, so it already serves `WHERE cartId = ?`.

If you add an index, say in a comment what query it serves.

---

## Rule: money is `Decimal`, never `Float`

Every monetary column is `Decimal @db.Decimal(10, 2)`, stored as Postgres
`numeric(10, 2)`. Currency is **LKR** throughout; there is no multi-currency support and
no currency column.

Binary floating point cannot represent `0.10` exactly. `0.1 + 0.2` is
`0.30000000000000004`. That error is invisible in one line item and then very visible in
a basket total, a tax figure, or a payment reconciliation report.

So:

- **Never** declare a money field as `Float`, and never `Number(price)` a Decimal.
- Construct money from **strings**: `money("12500.00")`, not `money(12500.00)`.
  Prisma accepts a string for any `Decimal` input — the seed relies on this.
- Do arithmetic with Decimal methods: `.add()`, `.sub()`, `.mul()`, `.div()`.
  Helpers live in [`src/lib/money.ts`](src/lib/money.ts) — `lineTotal`, `sumMoney`.
- Format with `formatPrice()`, which groups the exact string from `toFixed(2)`.
  It avoids `Intl.NumberFormat` precisely because that API's typings only accept
  `number`, which would reintroduce a float round-trip on every render.
- A Decimal is not serialisable to a Client Component as-is. Format it to a string on
  the server and pass the string down.

`stock` and `quantity` are `Int`. They are counts, not money.

## Rule: historical orders read their own snapshots

`OrderItem` stores `productName` and `unitPrice` at the time of purchase, and `Order`
stores the shipping address as flat `shipping*` fields. `OrderItem.productId` is
nullable and set to `NULL` when a product is deleted.

When rendering a past order, read those snapshot columns. **Never** join to `Product` to
get the name or price of a historical line, and never join to `Address` for where it
shipped. Renaming a product, repricing it, deleting it, or editing an address must not
rewrite history.

## Rule: data access goes in `src/server/`

`prisma` is imported in exactly two places: `src/lib/prisma.ts`, which creates it, and
modules under `src/server/`, which use it.

Never call `prisma` inline in a page, layout, or component. A page calls a named function:

```tsx
// src/app/products/[slug]/page.tsx
import { getProductBySlug } from "@/server/products";

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  // …
}
```

This keeps queries reviewable in one place, makes N+1s and missing `where` clauses
visible, and gives caching and authorisation a single place to live later.

Modules in `src/server/` start with `import "server-only"`, which makes the build fail
loudly if one is ever pulled into a client bundle rather than leaking queries to the
browser.

---

## Running things

Requires Node 20+, pnpm, and a PostgreSQL 16 database.

```bash
pnpm install                 # also runs prisma generate via postinstall
cp .env.example .env         # then set DATABASE_URL
pnpm db:migrate              # apply migrations (creates the schema)
pnpm db:seed                 # fill with sample data — safe to re-run
pnpm dev                     # http://localhost:3000
```

A throwaway local database:

```bash
docker run -d --name ecom-postgres \
  -e POSTGRES_USER=ecom -e POSTGRES_PASSWORD=ecom -e POSTGRES_DB=ecom \
  -p 5433:5432 postgres:16-alpine
```

Port **5433** is deliberate — it avoids colliding with a Postgres already on 5432.

### Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm db:migrate` | Create and apply a migration from schema changes |
| `pnpm db:deploy` | Apply existing migrations (production) |
| `pnpm db:reset` | Drop, re-migrate, re-seed. **Destroys data** |
| `pnpm db:seed` | Run `prisma/seed.ts` |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:studio` | Browse data. Pass `--port 5555` for a stable URL |

### Changing the schema

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate` — name the migration after the change (`add_wishlist`).
3. Commit the generated folder under `prisma/migrations/`. Never edit applied SQL;
   fix mistakes with a new migration.

### The seed

`prisma/seed.ts` inserts 5 categories, 30 products (each with 1–3 placeholder images
from picsum.photos, 4 of them out of stock), and 3 users — `admin@ecom.lk` plus two
normal accounts.

It is **idempotent**: rows are upserted on a natural unique key (category slug, product
slug, user email), and images are cleared and rewritten per product because they have no
natural key. Running it twice produces the same database as running it once. Keep it
that way — if you add seed data, upsert it.

`passwordHash` on seeded users is the literal placeholder
`seed-placeholder-not-a-real-hash`. No seeded account can be logged into. Replace it
with a real hash when authentication is built.
