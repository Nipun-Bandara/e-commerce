"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

import ProductImageManager from "@/components/admin/product-image-manager";
import FormField from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin-product-filters";
import { ADMIN_REQUEST_FAILED } from "@/lib/admin-result";
import {
  emptyProductFormState,
  type ProductFormState,
} from "@/lib/product-schemas";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  createProductAction,
  updateProductAction,
} from "@/server/admin-product-actions";

/**
 * The product form. One component for both creating and editing.
 *
 * Not two forms that drift apart: the fields, the rules, the slug behaviour and
 * the image panel are the same, and the only real differences are which action
 * is called and what the slug field does on its own. Those are two props.
 *
 * ## The slug follows the name until it does not
 *
 * On a new product, typing a name rewrites the slug — which is the behaviour
 * you want, because nobody wants to type it twice. The moment the admin edits
 * the slug themselves, that stops for good: the field is theirs now, and a
 * later tweak to the name must not silently undo their choice.
 *
 * On an existing product the sync never starts. The slug is a live URL, and
 * fixing a typo in the name is not consent to break every link to the product.
 *
 * ## Changing a slug is warned about, not prevented
 *
 * Editing the slug of a saved product shows a warning naming the URL that will
 * stop working. It does not block the save — renaming a product properly is a
 * real thing to want, and the admin is the one who knows whether anything links
 * to the old address.
 *
 * ## Validation lives on the server
 *
 * `required`, `inputMode` and the pattern hints below help someone typing.
 * They decide nothing. Every rule is in `productSchema` and re-run in the
 * action, and what comes back is either a redirect or the per-field messages
 * rendered here.
 *
 * ## Every field is controlled, and that is not a style choice
 *
 * React resets a `<form action={…}>` after its action resolves. For a form that
 * redirects on success that is invisible — but a *rejected* submit comes back
 * to a form React has just emptied, so the admin would read "that SKU is taken"
 * above nine blank inputs and have to retype all of them. `CheckoutForm` is
 * controlled for a different reason and gets this for free; the auth forms
 * solve it the other way, by echoing values back from the server. Controlled
 * state is the cheaper answer here, because the slug field needed it anyway.
 */

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  /** An exact decimal string, e.g. `"12500.00"`. Never a number. */
  price: string;
  stock: string;
  sku: string;
  categoryId: string;
  isActive: boolean;
  imageUrls: string[];
};

export default function ProductForm({
  mode,
  productId,
  initialValues,
  categories,
  canUpload,
  currency,
}: {
  mode: "create" | "edit";
  /** Required when editing — it is what the update action is keyed on. */
  productId?: string;
  initialValues: ProductFormValues;
  categories: { id: string; name: string }[];
  /** Whether an UploadThing token is configured. Decided on the server. */
  canUpload: boolean;
  /**
   * The currency code for the price label — `CURRENCY` from `lib/money.ts`,
   * read by the page and handed down.
   *
   * A prop rather than an import, because `lib/money.ts` *value*-imports the
   * generated Prisma client for `Decimal`. That is harmless on the server and
   * fatal here: importing one string from it would pull the entire Prisma
   * runtime into the browser bundle, and the build fails on the Node built-ins
   * it needs. This is the footgun `lib/cart-result.ts` documents, hit for
   * real — a pure-looking constant behind a module that is not pure.
   */
  currency: string;
}) {
  const isEdit = mode === "edit";

  // One object rather than eight `useState` calls: the form is submitted,
  // rejected and re-rendered as a unit, and a single setter keeps the eight
  // fields from being eight places to forget something.
  const [values, setValues] = useState(initialValues);

  /**
   * Whether the slug is the admin's to control.
   *
   * True from the start when editing: an existing slug is already a published
   * URL and must not move because someone corrected a typo in the name.
   */
  const [slugOwned, setSlugOwned] = useState(isEdit);

  const [state, setState] = useState<ProductFormState>(emptyProductFormState);
  const [isPending, startTransition] = useTransition();

  const slugChanged = isEdit && values.slug !== initialValues.slug;

  function setField<Field extends keyof ProductFormValues>(
    field: Field,
    value: ProductFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function onNameChange(value: string) {
    setValues((current) => ({
      ...current,
      name: value,
      // Only while the slug is still ours to fill in — see the note above.
      slug: slugOwned ? current.slug : slugify(value),
    }));
  }

  /** The props a text input needs: its value, its error and its setter. */
  function field(name: Exclude<keyof ProductFormValues, "isActive" | "imageUrls">) {
    return {
      name,
      value: values[name],
      error: state.fieldErrors[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setField(name, event.target.value),
    };
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateProductAction(productId ?? "", formData)
          : await createProductAction(formData);

        // A saved product redirects, so anything that comes back is a refusal.
        if (result) setState(result);
      } catch (error) {
        // `redirect()` reaches the client as a thrown control-flow signal.
        // Catching it here would swallow the navigation back to the list and
        // report a successful save as a failure.
        unstable_rethrow(error);
        setState({ formError: ADMIN_REQUEST_FAILED, fieldErrors: {} });
      }
    });
  }

  const { fieldErrors } = state;

  return (
    <form action={submit} className="flex max-w-3xl flex-col gap-6">
      {state.formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.formError}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
        <FormField
          {...field("name")}
          label="Name"
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
          required
        />

        <div className="flex flex-col gap-1.5">
          <FormField
            {...field("slug")}
            label="URL slug"
            onChange={(event) => {
              setField("slug", event.target.value);
              // Touching it once hands it over permanently — see the note above.
              setSlugOwned(true);
            }}
            hint={
              slugOwned
                ? "Lowercase letters, numbers and single hyphens."
                : "Filled in from the name. Edit it to take control."
            }
            autoComplete="off"
            required
          />

          {slugChanged ? (
            <p
              // `alert` rather than plain text: it appears in response to
              // something the admin just did, and it is the one thing on this
              // form with a consequence outside it.
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Changing the slug breaks existing links. Anything pointing at{" "}
                <code className="font-mono">/products/{initialValues.slug}</code>{" "}
                will start returning &ldquo;not found&rdquo;.
              </span>
            </p>
          ) : null}
        </div>

        <Textarea
          name="description"
          label="Description"
          value={values.description}
          onChange={(event) => setField("description", event.target.value)}
          error={fieldErrors.description}
          required
        />
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
        <FormField
          {...field("price")}
          label={`Price (${currency})`}
          // Not `type="number"`. A number input hands the browser a float to
          // round-trip, and this value has to survive as the exact decimal the
          // admin typed all the way to a `numeric(10, 2)` column.
          inputMode="decimal"
          hint="Up to two decimal places, e.g. 12500.50."
          autoComplete="off"
          required
        />

        <FormField
          {...field("stock")}
          label="Stock"
          inputMode="numeric"
          hint="A whole number. 0 marks it out of stock."
          autoComplete="off"
          required
        />

        <FormField
          {...field("sku")}
          label="SKU"
          hint="Must be unique across the catalogue."
          autoComplete="off"
          required
        />

        <CategorySelect
          categories={categories}
          value={values.categoryId}
          onChange={(value) => setField("categoryId", value)}
          error={fieldErrors.categoryId}
        />

        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="isActive"
            checked={values.isActive}
            onChange={(event) => setField("isActive", event.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Active</span>
            <span className="text-xs text-muted-foreground">
              Inactive products are hidden from the storefront and cannot be
              added to a cart. They stay here.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <ProductImageManager
          initialUrls={initialValues.imageUrls}
          canUpload={canUpload}
          error={fieldErrors.imageUrls}
        />
      </section>

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create product"}
        </Button>

        <Link
          href={ADMIN_PRODUCTS_PATH}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/**
 * The category picker.
 *
 * A native `<select>`, for the reason the sort control gives: one linear
 * choice, and the platform handles keyboard, touch and screen readers better
 * than a reimplementation would.
 *
 * The empty first option exists only when nothing is selected yet. Keeping it
 * after a choice is made would offer "no category" as an option, which the
 * schema rejects and the column does not allow.
 */
function CategorySelect({
  categories,
  value,
  onChange,
  error,
}: {
  categories: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = "categoryId-error";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="categoryId">Category</Label>

      <div className="relative">
        <select
          id="categoryId"
          name="categoryId"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          required
          className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          {value === "" ? (
            <option value="" disabled>
              Choose a category
            </option>
          ) : null}

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A multi-line field, wired up the way `FormField` wires a single-line one.
 *
 * Not folded into `FormField`: that component's whole contract is that it
 * renders an `<Input>` and forwards `<Input>`'s props, and adding an
 * `as="textarea"` switch would make every caller's prop types a union of two
 * elements to gain one shared wrapper.
 */
function Textarea({
  name,
  label,
  value,
  onChange,
  error,
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
}) {
  const errorId = `${name}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>

      <textarea
        id={name}
        name={name}
        rows={5}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
