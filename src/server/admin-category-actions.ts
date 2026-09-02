"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withFlash } from "@/lib/admin-flash";
import { adminError, type AdminResult } from "@/lib/admin-result";
import {
  categorySchema,
  toCategoryFieldErrors,
  type CategoryFormState,
} from "@/lib/category-schemas";
import { requireAdmin } from "@/server/auth";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/server/admin-categories";

/**
 * The three things the admin category screens let a browser invoke.
 *
 * Same shape and the same reasoning as `admin-product-actions.ts`: `"use
 * server"` makes every export a public endpoint, so the reads stay in
 * `admin-categories.ts` and each function here opens with `requireAdmin`. The
 * proxy never sees a Server Action and the admin layout is not in the call
 * path, so that first line is the entire authorisation.
 */

const ADMIN_CATEGORIES_PATH = "/admin/categories";

/**
 * A category rename changes the storefront's filter sidebar, its nav, the
 * category page's own heading and the admin table — the same "naming the routes
 * is a liability" argument the product actions make.
 */
function revalidateCategories() {
  revalidatePath("/", "layout");
}

function categoryFromFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    // The one optional field. An untouched textarea still posts `""`, and a
    // field stripped from the request posts nothing at all — both mean "no
    // description", and the schema turns either into NULL.
    description: formData.get("description") ?? "",
  };
}

export async function createCategoryAction(
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin(ADMIN_CATEGORIES_PATH);

  const parsed = categorySchema.safeParse(categoryFromFormData(formData));
  if (!parsed.success) {
    return { formError: null, fieldErrors: toCategoryFieldErrors(parsed.error) };
  }

  const result = await createCategory(parsed.data);

  if (result.status === "invalid") {
    return { formError: null, fieldErrors: { [result.field]: result.message } };
  }

  revalidateCategories();
  redirect(withFlash(ADMIN_CATEGORIES_PATH, "category-created"));
}

export async function updateCategoryAction(
  id: string,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin(ADMIN_CATEGORIES_PATH);

  // `id` crossed the network; its type is a claim, this guard is the fact.
  if (typeof id !== "string" || id.length === 0) {
    return { formError: "That request was not valid.", fieldErrors: {} };
  }

  const parsed = categorySchema.safeParse(categoryFromFormData(formData));
  if (!parsed.success) {
    return { formError: null, fieldErrors: toCategoryFieldErrors(parsed.error) };
  }

  const result = await updateCategory(id, parsed.data);

  if (result.status === "invalid") {
    return { formError: null, fieldErrors: { [result.field]: result.message } };
  }

  if (result.status === "not-found") {
    return {
      formError: "That category has been deleted. Nothing was saved.",
      fieldErrors: {},
    };
  }

  revalidateCategories();
  redirect(withFlash(ADMIN_CATEGORIES_PATH, "category-updated"));
}

/**
 * Delete a category, unless products still point at it.
 *
 * Whether it may be deleted is decided in `deleteCategory`, inside the
 * transaction, and comes back as an `error` result with the count in it. This
 * function does not pre-check: a count read here would be a different count by
 * the time the delete ran.
 */
export async function deleteCategoryAction(id: string): Promise<AdminResult> {
  await requireAdmin(ADMIN_CATEGORIES_PATH);

  if (typeof id !== "string" || id.length === 0) {
    return adminError("That request was not valid.");
  }

  const result = await deleteCategory(id);
  revalidateCategories();

  return result;
}
