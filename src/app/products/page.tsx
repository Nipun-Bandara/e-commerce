import type { Metadata } from "next";

import CategoryNav from "@/components/category-nav";
import Pagination from "@/components/pagination";
import ProductGrid from "@/components/product-grid";
import { parsePageParam } from "@/lib/pagination";
import { listCategories } from "@/server/categories";
import { getProducts } from "@/server/products";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse the full catalogue.",
};

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const requestedPage = parsePageParam((await searchParams).page);

  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    getProducts({ page: requestedPage }),
    listCategories(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">All products</h1>
        <p className="text-sm text-muted-foreground">
          {total === 1 ? "1 product" : `${total} products`}
        </p>
      </header>

      <CategoryNav categories={categories} />

      <ProductGrid
        products={products}
        emptyMessage="There are no products in the catalogue right now. Please check back soon."
      />

      <Pagination page={page} pageCount={pageCount} basePath="/products" />
    </div>
  );
}
