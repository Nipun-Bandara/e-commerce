"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withFlash } from "@/lib/admin-flash";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin-product-filters";
import { adminError, type AdminResult } from "@/lib/admin-result";
import {
  productSchema,
  stockUpdateSchema,
  toProductFieldErrors,
  type ProductFormState,
} from "@/lib/product-schemas";
import { requireAdmin } from "@/server/auth";
import {
  createProduct,
  deleteProduct,
  setProductStock,
  updateProduct,
} from "@/server/admin-products";

/**
 * The four things the admin product screens let a browser invoke.
 *
 * `"use server"` turns every export in a file into a public HTTP endpoint, so
 * this file is the complete, reviewable list of what is reachable from outside
 * — `listAdminProducts`, `getAdminStats` and the rest stay in
 * `admin-products.ts`, unreachable.
 *
 * ## Every one of these calls `requireAdmin`
 *
 * Not because the pages already do. **The pages are irrelevant here.** A Server
 * Action is a POST to a URL, and nothing about it goes through
 * `src/app/admin/layout.tsx` or the proxy — a signed-in USER who knows the
 * action id can invoke `deleteProductAction` directly, and the only thing
 * standing between them and someone else's catalogue is the first line of each
 * function below. The layout guard stops a normal user *browsing* to /admin;
 * this stops them *writing*. Both are needed, and neither substitutes for the
 * other.
 *
 * `requireAdmin` throws — `forbidden()` for a signed-in non-admin, a redirect
 * for a signed-out one — so there is no path past line one for either.
 *
 * ## Revalidation
 *
 * `revalidatePath("/", "layout")` rather than a list of routes. A product write
 * changes the catalogue, the category listing it belongs to, its own detail
 * page, the admin table and the dashboard counts, and hard-coding those five
 * means the sixth screen someone adds is stale until they remember this file.
 */

/** One product write touches enough screens that naming them is a liability. */
function revalidateProducts() {
  revalidatePath("/", "layout");
}

/**
 * Read the product form out of a `FormData`.
 *
 * Deliberately does no validating — `productSchema` does that, once, so there
 * is one place the rules live. All this does is name the fields.
 *
 * `imageUrl` is repeated rather than a JSON blob, one input per image in DOM
 * order, so `getAll` returns them in the order the admin arranged them and the
 * array index becomes `position`. Non-string entries are dropped: a `File` in
 * that field is not an ordering, it is someone poking at the endpoint.
 */
function productFromFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    // A checkbox posts `"on"` when ticked and is absent when it is not, so the
    // absence *is* the false — there is no "unchecked" value to read.
    isActive: formData.get("isActive") === "on",
    imageUrls: formData
      .getAll("imageUrl")
      .filter((value): value is string => typeof value === "string"),
  };
}

export async function createProductAction(
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin(ADMIN_PRODUCTS_PATH);

  const parsed = productSchema.safeParse(productFromFormData(formData));
  if (!parsed.success) {
    return { formError: null, fieldErrors: toProductFieldErrors(parsed.error) };
  }

  const result = await createProduct(parsed.data);

  if (result.status === "invalid") {
    // A taken slug or SKU belongs under its own input, not in a banner: the
    // admin has to change that one field and nothing else.
    return { formError: null, fieldErrors: { [result.field]: result.message } };
  }

  revalidateProducts();

  // The toast cannot survive this navigation, so the outcome travels as a code
  // in the URL and the list raises it on arrival. See `lib/admin-flash.ts`.
  redirect(withFlash(ADMIN_PRODUCTS_PATH, "product-created"));
}

export async function updateProductAction(
  id: string,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin(ADMIN_PRODUCTS_PATH);

  // `id` crossed the network, so its TypeScript type is a claim rather than a
  // fact. This guard is what actually holds.
  if (typeof id !== "string" || id.length === 0) {
    return { formError: "That request was not valid.", fieldErrors: {} };
  }

  const parsed = productSchema.safeParse(productFromFormData(formData));
  if (!parsed.success) {
    return { formError: null, fieldErrors: toProductFieldErrors(parsed.error) };
  }

  const result = await updateProduct(id, parsed.data);

  if (result.status === "invalid") {
    return { formError: null, fieldErrors: { [result.field]: result.message } };
  }

  if (result.status === "not-found") {
    return {
      formError: "That product has been deleted. Nothing was saved.",
      fieldErrors: {},
    };
  }

  revalidateProducts();
  redirect(withFlash(ADMIN_PRODUCTS_PATH, "product-updated"));
}

/**
 * Delete a product, or archive it if deleting would cut a past order loose.
 *
 * Which of the two happens is decided in `deleteProduct`, inside the
 * transaction — not here, and not by the button. The dialog that calls this
 * cannot know the answer, and the `warning` status is how the admin is told
 * that what they asked for is not what they got.
 */
export async function deleteProductAction(id: string): Promise<AdminResult> {
  await requireAdmin(ADMIN_PRODUCTS_PATH);

  if (typeof id !== "string" || id.length === 0) {
    return adminError("That request was not valid.");
  }

  const result = await deleteProduct(id);
  revalidateProducts();

  return result;
}

/**
 * The inline stock control on the product list.
 *
 * `stock` arrives as the string from the input rather than a number, so it goes
 * through the same rule the full form uses — a whole number, 0 or more, no
 * `"3.5"`, no `"1e9"`. Sharing the schema is the point: two definitions of a
 * valid stock figure is one definition of a valid stock figure.
 */
export async function updateStockAction(
  productId: string,
  stock: string,
): Promise<AdminResult> {
  await requireAdmin(ADMIN_PRODUCTS_PATH);

  const parsed = stockUpdateSchema.safeParse({ productId, stock });
  if (!parsed.success) {
    const [message] = parsed.error.issues.map((issue) => issue.message);

    return adminError(message ?? "That stock value was not valid.");
  }

  const result = await setProductStock(parsed.data.productId, parsed.data.stock);
  revalidateProducts();

  return result;
}
