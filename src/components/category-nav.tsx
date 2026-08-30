import Link from "next/link";

import { cn } from "@/lib/utils";

type CategoryNavItem = {
  name: string;
  slug: string;
};

/**
 * Category bar for the listing pages.
 *
 * The active entry is passed in rather than read from `usePathname()`, which
 * would make this a Client Component for no gain — the page already knows
 * which category it is rendering.
 */
export default function CategoryNav({
  categories,
  activeSlug,
}: {
  categories: CategoryNavItem[];
  /** Omit on /products, where "All products" is the active entry. */
  activeSlug?: string;
}) {
  const entries = [
    { name: "All products", slug: undefined, href: "/products" },
    ...categories.map((category) => ({
      name: category.name,
      slug: category.slug,
      href: `/products/category/${category.slug}`,
    })),
  ];

  return (
    <nav aria-label="Product categories">
      <ul className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const isActive = entry.slug === activeSlug;

          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {entry.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
