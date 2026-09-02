import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import ProductForm from "@/components/admin/product-form";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin-product-filters";
import { CURRENCY } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth";
import { listCategories } from "@/server/categories";

export const metadata: Metadata = {
  title: "New product · Admin",
};

/**
 * The create form.
 *
 * `requireAdmin` runs here as well as in the layout — the rule the brief sets,
 * and the one that keeps this page protected if it is ever rendered from
 * somewhere that is not under that layout.
 *
 * `canUpload` is decided on the server because that is the only place
 * `UPLOADTHING_TOKEN` exists. It is passed down as a boolean rather than the
 * token being exposed to the client under a `NEXT_PUBLIC_` name: the form only
 * needs to know *whether* uploads work, and the token is a credential.
 */
export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");

  const categories = await listCategories();
  const canUpload = Boolean(process.env.UPLOADTHING_TOKEN);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="New product"
        description="It appears on the storefront as soon as it is saved, if it is active."
        actions={
          <Link
            href={ADMIN_PRODUCTS_PATH}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <ArrowLeftIcon aria-hidden />
            Back to products
          </Link>
        }
      />

      {categories.length === 0 ? (
        // Every product needs a category, and the select would be empty. Saying
        // so beats a form that cannot be submitted for reasons it does not give.
        <p className="rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
          There are no categories yet, and every product needs one.{" "}
          <Link href="/admin/categories/new" className="underline underline-offset-4">
            Create a category
          </Link>{" "}
          first.
        </p>
      ) : (
        <ProductForm
          mode="create"
          canUpload={canUpload}
          // Read here rather than imported by the form: `lib/money.ts` pulls in
          // the Prisma client, which must not reach the browser bundle.
          currency={CURRENCY}
          categories={categories}
          initialValues={{
            name: "",
            slug: "",
            description: "",
            price: "",
            stock: "0",
            sku: "",
            // Empty rather than the first category: a pre-selected one is a
            // choice the admin never made, and it is silently wrong half the time.
            categoryId: "",
            isActive: true,
            imageUrls: [],
          }}
        />
      )}
    </div>
  );
}
