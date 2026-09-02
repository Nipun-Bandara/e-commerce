"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  TagsIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The admin navigation.
 *
 * A Client Component for one reason: `usePathname`. Which section you are in is
 * the single most useful thing this panel can tell you, and a server-rendered
 * nav cannot know it without every page passing its own name down — which is a
 * prop that goes stale the first time someone adds a route and forgets.
 *
 * A column beside the content on large screens, a scrolling row above it on
 * small ones. No drawer, no toggle: four items fit on a phone, and a menu
 * button would be a piece of state to manage for no gain.
 */

type NavItem = {
  href: string;
  label: string;
  icon: typeof PackageIcon;
  /** Rendered as a dimmed row with a "Soon" tag rather than a link. */
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/products", label: "Products", icon: PackageIcon },
  { href: "/admin/categories", label: "Categories", icon: TagsIcon },
  // Feature 9. Deliberately not a link: /admin/orders does not exist yet, and a
  // nav item that answers with a 404 reads as a broken panel rather than as an
  // unfinished one.
  { href: "/admin/orders", label: "Orders", icon: ReceiptTextIcon, comingSoon: true },
];

/**
 * Whether `href` is the section being viewed.
 *
 * `/admin` matches only itself — every admin URL starts with it, so a prefix
 * test would light up Dashboard on every page. The others match their subtree,
 * so /admin/products/new still highlights Products.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="shrink-0 border-b border-border bg-sidebar lg:w-56 lg:border-r lg:border-b-0"
    >
      <div className="flex h-full flex-col gap-1 overflow-x-auto p-3 lg:sticky lg:top-14 lg:overflow-x-visible">
        <p className="hidden px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
          Admin
        </p>

        <ul className="flex flex-row gap-1 lg:flex-col">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="shrink-0">
              <NavLink item={item} current={isCurrent(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function NavLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;

  const base =
    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors";

  if (item.comingSoon) {
    return (
      <span
        className={cn(base, "cursor-default text-muted-foreground/60")}
        // Announced as unavailable rather than merely looking greyed out.
        aria-disabled
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {item.label}
        <span className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-normal lg:inline">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      // `aria-current` is the accessible half of the highlight: without it the
      // styling says "you are here" only to people who can see it.
      aria-current={current ? "page" : undefined}
      className={cn(
        base,
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        current
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}
