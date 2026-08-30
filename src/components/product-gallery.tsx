"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Structural, rather than the `ProductDetail["images"]` element type, to keep
 * this file from importing `src/server/` — even for a type — since everything
 * there is marked `server-only`.
 */
type GalleryImage = {
  id: string;
  url: string;
  alt: string | null;
};

/**
 * Product image gallery: one large image, with thumbnails that switch it.
 *
 * The switch is local UI state, which is why this is the one Client Component
 * on the detail page. With a single image there is nothing to switch, so no
 * thumbnail strip is rendered.
 */
export default function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        No image available
      </div>
    );
  }

  const active = images[activeIndex] ?? images[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt ?? productName}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-pressed={isActive}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 10vw, 25vw"
                    className="object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
