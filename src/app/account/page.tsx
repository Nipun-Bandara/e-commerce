import type { Metadata } from "next";

import { requireAuth } from "@/server/auth";

export const metadata: Metadata = {
  title: "My account",
  description: "Your account details.",
};

export default async function AccountPage() {
  // Not a formality because the proxy already redirected: the proxy reads a
  // cookie, this reads the session the page will actually render from, and it
  // is the one that runs if the matcher ever stops covering this route.
  const user = await requireAuth("/account");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">My account</h1>
        <p className="text-sm text-muted-foreground">
          Your details as we have them.
        </p>
      </header>

      <dl className="divide-y divide-border rounded-xl border border-border">
        <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="w-32 shrink-0 text-sm text-muted-foreground">Name</dt>
          <dd className="text-sm font-medium">{user.name}</dd>
        </div>

        <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="w-32 shrink-0 text-sm text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium">{user.email}</dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">
        Editing these is not built yet.
      </p>
    </div>
  );
}
