import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CategoryNav from "@/components/category-nav";
import Pagination from "@/components/pagination";
import ProductGrid from "@/components/product-grid";
import { pageHref, parsePageParam } from "@/lib/pagination";
import { getCategoryBySlug, listCategories } from "@/server/categories";
import { getProducts } from "@/server/products";

export async function generateMetadata({
  params,
}: PageProps<"/products/category/[slug]">): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description: category.description ?? `Browse ${category.name}.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/products/category/[slug]">) {
  const { slug } = await params;
  const requestedPage = parsePageParam((await searchParams).page);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    getProducts({ page: requestedPage, categorySlug: slug }),
    listCategories(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {category.name}
        </h1>
        {category.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {category.description}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {total === 1 ? "1 product" : `${total} products`}
        </p>
      </header>

      <CategoryNav categories={categories} activeSlug={category.slug} />

      <ProductGrid
        products={products}
        emptyMessage={`There is nothing in ${category.name} at the moment. Try another category.`}
      />

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(next) =>
          pageHref(`/products/category/${category.slug}`, next)
        }
      />
    </div>
  );
}
