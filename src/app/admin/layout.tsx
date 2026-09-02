import { Suspense } from "react";

import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminFlashToast from "@/components/admin/admin-flash-toast";
import { requireAdmin } from "@/server/auth";

/**
 * The authorisation gate for everything under /admin, and the panel's chrome.
 *
 * A layout rather than a check repeated in each page: a layout cannot be
 * skipped by adding a route beneath it, so a new admin screen is protected the
 * moment it exists rather than the moment someone remembers.
 *
 * The proxy has already turned away anyone not signed in. What is left is a
 * real user without the role, and `requireAdmin` answers them with a 403 —
 * see `src/app/forbidden.tsx`. Each page calls it again, and so does every
 * Server Action: this guard covers *rendering* /admin, and a Server Action is a
 * POST that never passes through here.
 *
 * **Visually distinct on purpose.** The panel sits on `bg-muted`, not the
 * storefront's white, with a nav rail down the side. Nothing here is
 * destructive by accident, but "delete" means something different on this side
 * of the site and the page should not look like the one where it means
 * "remove from cart". The site header stays above it, which is also the way
 * back out to the shop.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");

  return (
    <div className="flex flex-1 flex-col bg-muted/40 lg:flex-row">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      {/*
        Mounted once for the whole panel rather than per page, so any screen
        that redirects with a `?flash=` code gets its toast. It reads
        `useSearchParams`, which forces a Suspense boundary — without one, every
        admin page would opt out of static rendering to satisfy this null.
      */}
      <Suspense fallback={null}>
        <AdminFlashToast />
      </Suspense>
    </div>
  );
}
