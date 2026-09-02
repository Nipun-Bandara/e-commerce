import Link from "next/link";
import type { Metadata } from "next";
import {
  BanknoteIcon,
  CalendarClockIcon,
  CircleSlashIcon,
  PackageIcon,
  ReceiptTextIcon,
  TagsIcon,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import RecentOrdersCard from "@/components/admin/recent-orders-card";
import TopProductsCard from "@/components/admin/top-products-card";
import {
  ADMIN_ORDERS_PATH,
  statusOrdersHref,
} from "@/lib/admin-order-filters";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, REVENUE_STATUSES } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/generated/prisma/enums";
import {
  getAdminOrderStats,
  listRecentAdminOrders,
  type AdminOrderStats,
} from "@/server/admin-orders";
import { getAdminStats } from "@/server/admin-products";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Dashboard · Admin",
};

/** The brief says five. Enough to see what has just come in. */
const RECENT_ORDERS_LIMIT = 5;

/**
 * The admin landing page: how the shop is doing, and the way into each section.
 *
 * `requireAdmin` again, even though the layout above already ran it. That is not
 * belt-and-braces for its own sake — it is the rule the brief sets and the one
 * that survives refactoring: if this page is ever moved, copied or rendered from
 * somewhere that is not under that layout, the guard travels with it.
 *
 * The three queries do not depend on each other, so they go out together rather
 * than the recent orders waiting on the revenue figure.
 *
 * **Every money figure here is a `Decimal` until it is formatted.** The revenue
 * total is a Postgres `sum()` over `numeric(10, 2)`, and `formatPrice` receives
 * the exact decimal string. Nothing on this page passes through a `number` — a
 * revenue figure that is a cent out is a revenue figure nobody trusts again.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin("/admin");

  const [[productCount, outOfStockCount, categoryCount], orderStats, recentOrders] =
    await Promise.all([
      getAdminStats(),
      getAdminOrderStats(),
      listRecentAdminOrders(RECENT_ORDERS_LIMIT),
    ]);

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Dashboard"
        description={`Signed in as ${admin.name}.`}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Sales</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Revenue"
            value={formatPrice(orderStats.revenue)}
            icon={BanknoteIcon}
            hint={`From ${orderStats.revenueOrderCount.toLocaleString("en")} ${
              orderStats.revenueOrderCount === 1 ? "order" : "orders"
            } that are ${REVENUE_STATUSES.map((status) =>
              ORDER_STATUS_LABELS[status].toLowerCase(),
            ).join(", ")}. Pending and cancelled orders are excluded.`}
          />

          <StatCard
            label={`Last ${orderStats.recentWindowDays} days`}
            value={orderStats.recentOrders.toLocaleString("en")}
            icon={CalendarClockIcon}
            hint="Orders placed, whatever status they are in now."
          />

          <StatCard
            label="Orders"
            value={orderStats.totalOrders.toLocaleString("en")}
            icon={ReceiptTextIcon}
            href={ADMIN_ORDERS_PATH}
            hint="Every order ever placed, across all customers."
          />
        </div>

        <StatusBreakdown counts={orderStats.countsByStatus} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentOrdersCard orders={recentOrders} />
        <TopProductsCard products={orderStats.topProducts} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Catalogue</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Products"
            value={productCount.toLocaleString("en")}
            icon={PackageIcon}
            href="/admin/products"
            hint="In the catalogue, active and inactive."
          />

          <StatCard
            label="Out of stock"
            value={outOfStockCount.toLocaleString("en")}
            icon={CircleSlashIcon}
            // Straight to the list already filtered and sorted to show them, so
            // the number is a starting point rather than a thing to go and find.
            href="/admin/products?sort=stock-asc"
            hint={
              outOfStockCount === 0
                ? "Everything has stock."
                : "Sorted to the top of the product list."
            }
            alert={outOfStockCount > 0}
          />

          <StatCard
            label="Categories"
            value={categoryCount.toLocaleString("en")}
            icon={TagsIcon}
            href="/admin/categories"
            hint="Every product belongs to one."
          />
        </div>
      </section>
    </div>
  );
}

/**
 * How many orders sit in each status, each one a way into the filtered list.
 *
 * Every status is listed, including the ones with no orders. A row that
 * disappears when its count reaches zero reads as a missing row rather than as
 * a zero, and "are there any cancelled orders?" is a question this should
 * answer with a number instead of an absence.
 */
function StatusBreakdown({
  counts,
}: {
  counts: AdminOrderStats["countsByStatus"];
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="text-sm font-medium">Orders by status</h3>

      {/* A grid of links rather than a `<dl>`: an anchor is not valid as a
          direct child of `<dl>`, and wrapping each pair in a `<div>` to make it
          legal would be markup that exists only to satisfy the validator. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(counts) as OrderStatus[]).map((status) => (
          <Link
            key={status}
            href={statusOrdersHref(status)}
            className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2 outline-none transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="text-xs text-muted-foreground">
              {ORDER_STATUS_LABELS[status]}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {counts[status].toLocaleString("en")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * One figure.
 *
 * `value` is a preformatted string rather than a number, because half of these
 * are counts and half are money — and money is a `Decimal` that must be turned
 * into text by `formatPrice`, never by `toLocaleString` on a `number`.
 *
 * A link when there is somewhere to go, a plain card otherwise.
 */
function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  alert = false,
}: {
  label: string;
  value: string;
  icon: typeof PackageIcon;
  href?: string;
  hint: string;
  alert?: boolean;
}) {
  const className = cn(
    "flex flex-col gap-3 rounded-xl border bg-background p-4 transition-colors",
    alert ? "border-destructive/40" : "border-border",
    href &&
      "outline-none hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon
          aria-hidden
          className={cn(
            "size-4",
            alert ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </div>

      <p
        className={cn(
          "text-3xl font-semibold tabular-nums",
          alert && "text-destructive",
        )}
      >
        {value}
      </p>

      <p className="text-xs text-muted-foreground">{hint}</p>
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
