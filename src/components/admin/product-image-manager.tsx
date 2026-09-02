"use client";

import { useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImagePlusIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-schemas";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

/**
 * The product's images: adding, removing, and putting them in order.
 *
 * ## Order is the feature
 *
 * `ProductImage.position` decides which image is the thumbnail on a product
 * card and which order the gallery runs in. This component's whole job is to
 * let an admin set that by arranging tiles, and its output is one hidden
 * `imageUrl` input per image, **in DOM order** — which is the order
 * `formData.getAll("imageUrl")` returns them in, which becomes the array index,
 * which becomes `position`. The first tile is the primary image, and it is
 * labelled as such rather than leaving that to be inferred.
 *
 * ## Dragging is not the only way to reorder
 *
 * Drag-and-drop is the obvious gesture and it is unusable with a keyboard, with
 * a screen reader, and on a touch screen where the same gesture scrolls the
 * page. So every tile also carries move-left and move-right buttons. They are
 * not a fallback for when dragging fails — they are the accessible interface,
 * and dragging is the shortcut on top of it.
 *
 * ## Nothing is written until the form is submitted
 *
 * Uploading puts a file in storage and returns a URL; removing a tile drops it
 * from this list. Neither touches the database — the `ProductImage` rows are
 * written by `createProduct`/`updateProduct` in one transaction with the
 * product. So "remove an image before saving" and "close the tab without
 * saving" both do the obvious thing. The cost is that a file uploaded and then
 * removed stays in UploadThing storage, unreferenced; that is deliberate, and
 * cheaper than a delete that could fire while the row still points at it.
 *
 * ## Two ways in
 *
 * With `UPLOADTHING_TOKEN` set, files upload. Without it, the panel takes pasted
 * image URLs instead — which is how the seeded picsum images got there, and
 * what keeps this screen working on a machine with no UploadThing account. The
 * ordering, removing and primary-image logic are identical either way, because
 * both paths do the same thing: append a URL to this list.
 */
export default function ProductImageManager({
  initialUrls,
  canUpload,
  error,
}: {
  /** Existing images, in position order. Empty for a new product. */
  initialUrls: string[];
  /** Whether an UploadThing token is configured — decided on the server. */
  canUpload: boolean;
  /** A server-side complaint about the image list, e.g. too many. */
  error?: string;
}) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const showToast = useToast();

  /** Index being dragged. `null` when nothing is. */
  const dragging = useRef<number | null>(null);

  const isFull = urls.length >= MAX_PRODUCT_IMAGES;
  const remaining = MAX_PRODUCT_IMAGES - urls.length;

  /**
   * Append URLs, ignoring ones already in the list and anything past the cap.
   *
   * Duplicates are dropped rather than rejected: uploading the same file twice
   * is an accident, and two tiles pointing at one image would be two positions
   * for the same picture.
   */
  function add(incoming: string[]) {
    setUrls((current) => {
      const next = [...current];

      for (const url of incoming) {
        if (next.length >= MAX_PRODUCT_IMAGES) break;
        if (next.includes(url)) continue;
        next.push(url);
      }

      return next;
    });
  }

  function remove(index: number) {
    setUrls((current) => current.filter((_, i) => i !== index));
  }

  /** Move the image at `from` to `to`, clamping so the ends are no-ops. */
  function move(from: number, to: number) {
    setUrls((current) => {
      if (to < 0 || to >= current.length || from === to) return current;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      return next;
    });
  }

  const errorId = "product-images-error";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label>Images</Label>
        <span className="text-xs text-muted-foreground">
          {urls.length} of {MAX_PRODUCT_IMAGES}
        </span>
      </div>

      {urls.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {urls.map((url, index) => (
              <ImageTile
                key={url}
                url={url}
                index={index}
                total={urls.length}
                onRemove={() => remove(index)}
                onMove={(to) => move(index, to)}
                onDragStart={() => {
                  dragging.current = index;
                }}
                onDrop={() => {
                  const from = dragging.current;
                  dragging.current = null;
                  if (from !== null) move(from, index);
                }}
              />
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            The first image is the thumbnail on the storefront. Drag a tile, or
            use its arrows, to change the order.
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
          No images yet. A product without one shows a placeholder on the
          storefront.
        </p>
      )}

      {/*
        The hidden inputs are the actual output of this component. One per
        image, in order, named `imageUrl` — see the note at the top.
      */}
      {urls.map((url, index) => (
        <input key={`${url}-${index}`} type="hidden" name="imageUrl" value={url} />
      ))}

      {isFull ? (
        <p className="text-xs text-muted-foreground">
          That is the maximum. Remove one to add another.
        </p>
      ) : canUpload ? (
        <UploadPanel
          remaining={remaining}
          onUploaded={add}
          onError={(message) => showToast(message, "error")}
        />
      ) : (
        <UrlPanel onAdd={(url) => add([url])} />
      )}

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One image, with its controls. */
function ImageTile({
  url,
  index,
  total,
  onRemove,
  onMove,
  onDragStart,
  onDrop,
}: {
  url: string;
  index: number;
  total: number;
  onRemove: () => void;
  onMove: (to: number) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const isPrimary = index === 0;
  const position = `${index + 1} of ${total}`;

  return (
    <li
      draggable
      onDragStart={onDragStart}
      // Without `preventDefault` on drag-over the browser refuses the drop.
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "group relative flex cursor-grab flex-col overflow-hidden rounded-lg border bg-background active:cursor-grabbing",
        isPrimary ? "border-foreground/40" : "border-border",
      )}
    >
      <div className="relative aspect-square bg-muted">
        {/*
          A plain <img>, not next/image. The URL was typed or uploaded a second
          ago and next/image would refuse any host not in `remotePatterns` —
          which is right for the storefront and wrong for a preview whose whole
          purpose is to show the admin what they just added. The storefront
          renders these through next/image once they are saved.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Product image ${position}`}
          className="size-full object-cover"
          // Dragging the <img> instead of the tile is the browser's default and
          // it breaks the reorder.
          draggable={false}
        />

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove image ${position}`}
          className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-background/90 text-muted-foreground shadow-sm outline-none hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>

        {isPrimary ? (
          <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-medium shadow-sm">
            Primary
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-1 border-t border-border px-1.5 py-1">
        <span className="pl-1 text-[0.65rem] text-muted-foreground tabular-nums">
          {position}
        </span>

        <span className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
            aria-label={`Move image ${position} earlier`}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
            aria-label={`Move image ${position} later`}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </span>
      </div>
    </li>
  );
}

/**
 * The file picker, when UploadThing is configured.
 *
 * Rendered only when a token exists, which is also why `useUploadThing` is
 * called in here rather than in the parent: the hook fetches the endpoint's
 * route config on mount, and mounting it without a token would mean a failed
 * request on every page load of a form that is not offering uploads anyway.
 *
 * It is a labelled `<input type="file">` styled as a button, plus a drop zone
 * around it — not a bare div with `onDrop`. The file input is what makes this
 * reachable by keyboard and announced as a file control; the drop target is
 * the shortcut layered on top.
 */
function UploadPanel({
  remaining,
  onUploaded,
  onError,
}: {
  remaining: number;
  onUploaded: (urls: string[]) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const { startUpload, isUploading } = useUploadThing("productImage", {
    onClientUploadComplete: (files) => {
      onUploaded(files.map((file) => file.serverData.url));
    },
    onUploadError: (uploadError) => {
      // The message comes from the endpoint's error formatter — "Unauthorized"
      // for a non-admin, a size complaint for an oversized file. Passing it
      // through beats a generic failure that gives no way to fix it.
      onError(uploadError.message || "That upload failed. Please try again.");
    },
  });

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const chosen = Array.from(files).slice(0, remaining);
    if (chosen.length < files.length) {
      onError(
        `Only ${remaining} more ${remaining === 1 ? "image" : "images"} can be added.`,
      );
    }
    if (chosen.length === 0) return;

    void startUpload(chosen);

    // Let the same file be picked again after a removal. Without this the
    // input's value is unchanged and `onChange` never fires a second time.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        upload(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
        isOver ? "border-foreground/40 bg-muted/60" : "border-border bg-background",
      )}
    >
      <input
        ref={inputRef}
        id="product-image-upload"
        type="file"
        accept="image/*"
        multiple
        disabled={isUploading}
        onChange={(event) => upload(event.target.files)}
        className="sr-only"
      />

      <Label
        htmlFor="product-image-upload"
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        {isUploading ? (
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
        ) : (
          <ImagePlusIcon aria-hidden className="size-4" />
        )}
        {isUploading ? "Uploading…" : "Choose images"}
      </Label>

      <p className="text-xs text-muted-foreground">
        Or drop them here. Up to 4 MB each, {remaining} more{" "}
        {remaining === 1 ? "image" : "images"}.
      </p>
    </div>
  );
}

/**
 * The fallback: paste an image URL.
 *
 * What the panel offers when no `UPLOADTHING_TOKEN` is configured, so the admin
 * screens are fully usable — and testable — without an UploadThing account.
 *
 * Not a nested `<form>`: this sits inside the product form, and a form inside a
 * form is invalid HTML that browsers resolve by dropping the inner one. So the
 * "Add" button is a plain button and Enter is handled explicitly, which also
 * stops Enter in this field from submitting the product.
 */
function UrlPanel({ onAdd }: { onAdd: (url: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const url = value.trim();
    if (url === "") return;

    // A soft check, so a typo is caught before it becomes a broken tile. The
    // rule that actually holds is in `productSchema`, on the server.
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setError("Enter an image URL starting with http:// or https://.");
      return;
    }

    onAdd(url);
    setValue("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background p-3">
      <Label htmlFor="product-image-url" className="text-xs font-medium">
        Add an image by URL
      </Label>

      <div className="flex gap-2">
        <Input
          id="product-image-url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/photo.jpg"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Without this, Enter here submits the product form.
            event.preventDefault();
            commit();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "product-image-url-error" : undefined}
          className="h-9"
        />

        <Button type="button" variant="outline" size="lg" onClick={commit}>
          Add
        </Button>
      </div>

      {error ? (
        <p id="product-image-url-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          File uploads appear here once <code>UPLOADTHING_TOKEN</code> is set in
          your environment.
        </p>
      )}
    </div>
  );
}
