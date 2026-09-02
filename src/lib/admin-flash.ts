/**
 * Success messages that have to survive a redirect.
 *
 * Saving a product ends in `redirect()` to the list, which tears down the tree
 * that would have raised the toast. So the outcome travels in the URL and the
 * new page raises it on arrival — see `admin-flash-toast.tsx`.
 *
 * **Codes, not messages.** `?flash=product-created` rather than
 * `?flash=Product%20saved`. The message never leaves this file, so a link
 * someone was sent cannot make the admin panel display a sentence of the
 * sender's choosing. React would escape the text either way — this is not about
 * script injection, it is that "Your session expired, sign in again at…" is a
 * convincing thing to put on a page the reader trusts. An unrecognised code
 * shows nothing at all.
 */

const FLASH_MESSAGES = {
  "product-created": "Product created.",
  "product-updated": "Product saved.",
  "category-created": "Category created.",
  "category-updated": "Category saved.",
} as const;

export type FlashCode = keyof typeof FLASH_MESSAGES;

/** The query key. One constant so the writer and the reader cannot drift apart. */
export const FLASH_PARAM = "flash";

/** The message for a code, or `null` for anything not in the table above. */
export function flashMessage(code: string | string[] | undefined): string | null {
  const raw = Array.isArray(code) ? code[0] : code;
  if (!raw) return null;

  return raw in FLASH_MESSAGES
    ? FLASH_MESSAGES[raw as FlashCode]
    : null;
}

/** `path` with a flash code attached, for a `redirect()` after a successful write. */
export function withFlash(path: string, code: FlashCode): string {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}${FLASH_PARAM}=${code}`;
}
