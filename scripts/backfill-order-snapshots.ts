import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

/**
 * One-off repair: fill in `OrderItem` snapshot columns that were never written.
 *
 * ## Read this before running it
 *
 * This script breaks the rule the rest of the codebase is built around. An
 * `OrderItem` snapshot is what a line *cost at the time it was bought*, and
 * that number does not exist anywhere else — if it was never recorded, it is
 * gone. Copying today's `Product.price` into it does not recover the price; it
 * invents a plausible one and makes it indistinguishable from a real one.
 *
 * So this is a last resort for rows that are already broken, not a migration.
 * A row it touches becomes *readable* rather than *correct*: the order will
 * render, and its line total may disagree with the `Order.total` that was
 * actually charged. That disagreement is the honest signal that the row was
 * repaired, and it is the reason this prints every change it intends to make.
 *
 * ## What counts as missing
 *
 * `productName` and `unitPrice` are `NOT NULL` in the schema with no default,
 * and `createOrder` writes both from the live `Product` row inside the order
 * transaction. There is no code path that can leave either unset, so on a
 * database only ever written by this application the answer is zero rows.
 * What remains possible is a sentinel written by something else — an empty
 * name, or a zero price — and those are what this looks for.
 *
 * ## Usage
 *
 *   npx tsx scripts/backfill-order-snapshots.ts            # report only
 *   npx tsx scripts/backfill-order-snapshots.ts --apply    # report, then write
 *
 * Reporting is the default. Nothing is written without `--apply`.
 */

const APPLY = process.argv.includes("--apply");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** An empty name or a zero price — see "What counts as missing" above. */
const MISSING_SNAPSHOT: Prisma.OrderItemWhereInput = {
  OR: [{ productName: "" }, { unitPrice: new Prisma.Decimal(0) }],
};

function formatLine(
  orderNumber: string,
  from: { productName: string; unitPrice: Prisma.Decimal },
  to: { name: string; price: Prisma.Decimal },
): string {
  const name =
    from.productName === "" ? `"" -> ${JSON.stringify(to.name)}` : from.productName;
  const price = from.unitPrice.isZero()
    ? `${from.unitPrice.toFixed(2)} -> ${to.price.toFixed(2)}`
    : from.unitPrice.toFixed(2);

  return `  ${orderNumber}  name: ${name}  unitPrice: ${price}`;
}

async function main() {
  const candidates = await prisma.orderItem.findMany({
    where: MISSING_SNAPSHOT,
    select: {
      id: true,
      productName: true,
      unitPrice: true,
      order: { select: { orderNumber: true } },
      // The only place a replacement value can come from. A line whose product
      // was deleted has `productId` NULL and nothing to read.
      product: { select: { name: true, price: true } },
    },
    orderBy: { id: "asc" },
  });

  const repairable = candidates.filter((item) => item.product !== null);
  const orphaned = candidates.length - repairable.length;

  console.log(`OrderItem rows with a missing snapshot: ${candidates.length}`);
  console.log(`  repairable (product still exists):   ${repairable.length}`);
  console.log(`  unrepairable (product deleted):      ${orphaned}`);

  if (candidates.length === 0) {
    console.log("\nNothing to do. Every OrderItem carries its own snapshot.");
    return;
  }

  console.log(`\nRows this would write (${repairable.length}):`);
  for (const item of repairable) {
    // `repairable` is filtered on it, but the filter does not narrow the type.
    const product = item.product as { name: string; price: Prisma.Decimal };
    console.log(formatLine(item.order.orderNumber, item, product));
  }

  if (orphaned > 0) {
    console.log(
      `\n${orphaned} row(s) cannot be repaired: the product was deleted, so there is` +
        "\nno row left to copy from. These need a value from an invoice or a backup.",
    );
  }

  if (!APPLY) {
    console.log(
      "\nReport only — nothing was written. Re-run with --apply to write these.",
    );
    return;
  }

  // One transaction: a half-finished repair is harder to reason about than an
  // unrepaired one, and this is small enough to do in a single unit.
  await prisma.$transaction(
    repairable.map((item) => {
      const product = item.product as { name: string; price: Prisma.Decimal };

      return prisma.orderItem.update({
        where: { id: item.id },
        data: {
          // Only the column that is actually empty is overwritten. A row with a
          // good name and a zero price keeps its name.
          ...(item.productName === "" ? { productName: product.name } : {}),
          ...(item.unitPrice.isZero() ? { unitPrice: product.price } : {}),
        },
      });
    }),
  );

  console.log(`\nWrote ${repairable.length} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
