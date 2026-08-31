import Link from "next/link";

import UserMenu from "@/components/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";

/**
 * "Login / Sign up", or the user's name and its menu.
 *
 * Its own async component for the same reason as `CartCountBadge`: reading the
 * session is a request-time API, and keeping it here lets the header sit behind
 * a `<Suspense>` boundary instead of holding up every page in the site.
 */
export default async function HeaderAuth() {
  const user = await getCurrentUser();

  if (user) return <UserMenu name={user.name} />;

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
      >
        Login
      </Link>
      <Link
        href="/register"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
      >
        Sign up
      </Link>
    </div>
  );
}
