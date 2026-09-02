"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, PackageIcon, UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/auth-actions";

/**
 * The signed-in half of the header: a name, and what you can do with it.
 *
 * Logging out is a `<form>` posting to a Server Action, not a link. It changes
 * state on the server, and a GET that does that is one prefetch away from
 * signing people out on its own.
 *
 * Only the name crosses to the browser. Role, id and email stay on the server —
 * nothing rendered here needs them.
 */
export default function UserMenu({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg">
          <UserIcon aria-hidden />
          <span className="max-w-32 truncate">{name}</span>
          <ChevronDownIcon aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon aria-hidden />
            My account
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/account/orders">
            <PackageIcon aria-hidden />
            My orders
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* The submit button is the menu item, not the form around it: Radix
            activates whatever it made the item, and a form is not something
            Enter can submit from the outside. */}
        <form action={logoutAction}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOutIcon aria-hidden />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
