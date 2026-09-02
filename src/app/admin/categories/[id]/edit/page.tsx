import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import CategoryForm from "@/components/admin/category-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminCategoryById } from "@/server/admin-categories";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Edit category · Admin",
};

/**
 * The category edit form, keyed on id rather than slug for the reason the
 * product edit page gives: this form can change the slug, and a slug-keyed URL
 * would 404 the moment a rename saved.
 */
export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/categories/[id]/edit">) {
  const { id } = await params;

  await requireAdmin(`/admin/categories/${id}/edit`);

  const category = await getAdminCategoryById(id);
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title={category.name}
        description={`Shown on the storefront at /products/category/${category.slug}.`}
        actions={
          <Link
            href="/admin/categories"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <ArrowLeftIcon aria-hidden />
            Back to categories
          </Link>
        }
      />

      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initialValues={{
          name: category.name,
          slug: category.slug,
          // NULL in the column, empty in the textarea. The schema turns it back
          // into NULL on save, so a description never round-trips into "".
          description: category.description ?? "",
        }}
      />
    </div>
  );
}
