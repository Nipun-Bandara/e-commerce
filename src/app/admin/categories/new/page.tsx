import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import CategoryForm from "@/components/admin/category-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "New category · Admin",
};

export default async function NewCategoryPage() {
  await requireAdmin("/admin/categories/new");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="New category"
        description="Categories group the catalogue and drive the storefront's filters."
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
        mode="create"
        initialValues={{ name: "", slug: "", description: "" }}
      />
    </div>
  );
}
