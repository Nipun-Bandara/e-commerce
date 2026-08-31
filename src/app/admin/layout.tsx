import { requireAdmin } from "@/server/auth";

/**
 * The authorisation gate for everything under /admin.
 *
 * A layout rather than a check repeated in each page: a layout cannot be
 * skipped by adding a route beneath it, so a new admin screen is protected the
 * moment it exists rather than the moment someone remembers.
 *
 * The proxy has already turned away anyone not signed in. What is left is a
 * real user without the role, and `requireAdmin` answers them with a 403 —
 * see `src/app/forbidden.tsx`.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");

  return children;
}
