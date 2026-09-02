import Link from "next/link";
import type { Metadata } from "next";
import {
  CircleSlashIcon,
  PackageIcon,
  ReceiptTextIcon,
  TagsIcon,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import { cn } from "@/lib/utils";
import { getAdminStats } from "@/server/admin-products";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Dashboard · Admin",
};

/**
 * The admin landing page: four counts and the way into each section.
 *
 * `requireAdmin` again, even though the layout above already ran it. That is
 * not belt-and-braces for its own sake — it is the rule the brief sets and the
 * one that survives refactoring: if this page is ever moved, copied or rendered
 * from somewhere that is not under that layout, the guard travels with it.
 *
 * Out-of-stock is the only card that changes appearance. The other three are
 * inventory figures; that one is a thing to go and do something about, and it
 * says so only when the number is not zero.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin("/admin");

  const [productCount, outOfStockCount, categoryCount, orderCount] =
    await getAdminStats();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Dashboard"
        description={`Signed in as ${admin.name}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={productCount}
          icon={PackageIcon}
          href="/admin/products"
          hint="In the catalogue, active and inactive."
        />

        <StatCard
          label="Out of stock"
          value={outOfStockCount}
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
          value={categoryCount}
          icon={TagsIcon}
          href="/admin/categories"
          hint="Every product belongs to one."
        />

        <StatCard
          label="Orders"
          value={orderCount}
          icon={ReceiptTextIcon}
          hint="Order management arrives with the next feature."
        />
      </div>
    </div>
  );
}

/**
 * One count.
 *
 * A link when there is somewhere to go, a plain card otherwise — the orders
 * figure is real, but /admin/orders is not built yet, and a card that looks
 * clickable and is not is worse than one that never claimed to be.
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
  value: number;
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
        {value.toLocaleString("en")}
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
