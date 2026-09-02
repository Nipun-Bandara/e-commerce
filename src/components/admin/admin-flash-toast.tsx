"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/toast";
import { FLASH_PARAM, flashMessage } from "@/lib/admin-flash";

/**
 * Raises the toast for a write that ended in a redirect.
 *
 * Saving a product navigates to the list, which tears down the form that would
 * otherwise have shown the confirmation. So the action puts a code in the URL
 * and this component turns it into a toast on arrival.
 *
 * Two things it has to get right:
 *
 *  1. **Show it once.** `useEffect` runs again on any re-render that changes
 *     its dependencies, and a toast that reappears when you tick a filter is
 *     worse than no toast. The ref records that this code has been shown.
 *  2. **Take the code back out of the URL.** Left in place, `?flash=` would be
 *     carried into every filter link built from the current params, and a
 *     refresh or a shared link would announce a save that happened yesterday.
 *     `replace` rather than `push`, so the back button does not walk into the
 *     URL that was just cleaned up.
 */
export default function AdminFlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useToast();
  const shown = useRef<string | null>(null);

  const code = searchParams.get(FLASH_PARAM);

  useEffect(() => {
    if (!code || shown.current === code) return;

    const message = flashMessage(code);
    shown.current = code;

    // An unrecognised code shows nothing, but is still stripped: a stale or
    // hand-written `?flash=` should not stay in the address bar either.
    if (message) showToast(message, "success");

    const next = new URLSearchParams(searchParams);
    next.delete(FLASH_PARAM);
    const query = next.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [code, pathname, router, searchParams, showToast]);

  return null;
}
