import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCartForm from "@/components/add-to-cart-form";
import ProductGallery from "@/components/product-gallery";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { getProductBySlug } from "@/server/products";

/** Products with fewer than this many units left get a scarcity note. */
const LOW_STOCK_THRESHOLD = 5;

/** Meta descriptions are truncated by search engines around this length. */
const META_DESCRIPTION_LENGTH = 160;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function stockLabel(stock: number): string {
  if (stock === 0) return "Out of stock";
  if (stock < LOW_STOCK_THRESHOLD) return `Only ${stock} left`;
  return "In stock";
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: truncate(product.description, META_DESCRIPTION_LENGTH),
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const isOutOfStock = product.stock === 0;
  const isLowStock = !isOutOfStock && product.stock < LOW_STOCK_THRESHOLD;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground hover:underline">
          Products
        </Link>
        <span className="px-2" aria-hidden>
          /
        </span>
        <Link
          href={`/products/category/${product.category.slug}`}
          className="hover:text-foreground hover:underline"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Link
              href={`/products/category/${product.category.slug}`}
              className="w-fit"
            >
              <Badge variant="outline">{product.category.name}</Badge>
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>

            <p className="text-2xl font-medium tabular-nums">
              {formatPrice(product.price)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={
                isOutOfStock ? "secondary" : isLowStock ? "destructive" : "outline"
              }
            >
              {stockLabel(product.stock)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              SKU {product.sku}
            </span>
          </div>

          <AddToCartForm productId={product.id} stock={product.stock} />

          {/* A plain rule rather than <Separator />: that shadcn primitive is
              a Client Component, and the gallery is meant to be the only one
              on this page. */}
          <hr className="border-border" />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Description</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {product.description}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
