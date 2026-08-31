import type { Metadata } from "next";

import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Admin",
};

/**
 * A placeholder. The admin screens are not built — this route exists so that
 * /admin is a real destination for the guard above it to protect, rather than
 * a 404 that would look identical to a working refusal.
 */
export default async function AdminPage() {
  const admin = await requireAdmin("/admin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {admin.name}. Nothing to manage here yet.
      </p>
    </div>
  );
}
