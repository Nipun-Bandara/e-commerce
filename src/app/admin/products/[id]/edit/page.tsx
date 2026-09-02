import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import ProductForm from "@/components/admin/product-form";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin-product-filters";
import { CURRENCY } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAdminProductById } from "@/server/admin-products";
import { requireAdmin } from "@/server/auth";
import { listCategories } from "@/server/categories";

export const metadata: Metadata = {
  title: "Edit product · Admin",
};

/**
 * The edit form, pre-filled.
 *
 * Keyed on the product **id**, not its slug, because this form can change the
 * slug: a slug-keyed URL would navigate to a 404 the moment a rename saved.
 *
 * `price` is a Prisma Decimal and is turned into its exact string here, on the
 * server. Two reasons, and both matter: a Decimal handed to a Client Component
 * would not survive serialisation, and `toFixed(2)` is the only conversion that
 * does not pass the value through a float on the way to the input.
 */
export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await params;

  await requireAdmin(`/admin/products/${id}/edit`);

  const [product, categories] = await Promise.all([
    getAdminProductById(id),
    listCategories(),
  ]);

  // A deleted product, or a hand-typed id. 404 rather than an empty form.
  if (!product) notFound();

  const canUpload = Boolean(process.env.UPLOADTHING_TOKEN);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title={product.name}
        description={
          product.isActive ? (
            <>
              Live at{" "}
              <Link
                href={`/products/${product.slug}`}
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                /products/{product.slug}
                <ExternalLinkIcon aria-hidden className="size-3" />
              </Link>
            </>
          ) : (
            "Inactive — hidden from the storefront."
          )
        }
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

      <ProductForm
        mode="edit"
        productId={product.id}
        canUpload={canUpload}
        // Read here rather than imported by the form: `lib/money.ts` pulls in
        // the Prisma client, which must not reach the browser bundle.
        currency={CURRENCY}
        categories={categories}
        initialValues={{
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price.toFixed(2),
          stock: String(product.stock),
          sku: product.sku,
          categoryId: product.categoryId,
          isActive: product.isActive,
          // Already ordered by position — `getAdminProductById` sorts them, and
          // that order is the one the image panel starts from.
          imageUrls: product.images.map((image) => image.url),
        }}
      />
    </div>
  );
}
