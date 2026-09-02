"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import FormField from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ADMIN_REQUEST_FAILED } from "@/lib/admin-result";
import {
  emptyCategoryFormState,
  type CategoryFormState,
} from "@/lib/category-schemas";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/server/admin-category-actions";

/**
 * The category form, for creating and editing.
 *
 * The same shape as `ProductForm` and for the same reasons — one component so
 * the two screens cannot drift, the slug following the name until the admin
 * takes it over, and a warning rather than a block when an existing slug
 * changes. See the notes there; nothing about the reasoning differs, only the
 * three fields it applies to.
 */

const ADMIN_CATEGORIES_PATH = "/admin/categories";

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
};

export default function CategoryForm({
  mode,
  categoryId,
  initialValues,
}: {
  mode: "create" | "edit";
  /** Required when editing — it is what the update action is keyed on. */
  categoryId?: string;
  initialValues: CategoryFormValues;
}) {
  const isEdit = mode === "edit";

  // Controlled, like `ProductForm` and for the same reason: React resets a
  // `<form action={…}>` once its action resolves, so a rejected submit would
  // come back to inputs it had just emptied.
  const [values, setValues] = useState(initialValues);
  const [slugOwned, setSlugOwned] = useState(isEdit);
  const [state, setState] = useState<CategoryFormState>(emptyCategoryFormState);
  const [isPending, startTransition] = useTransition();

  const slugChanged = isEdit && values.slug !== initialValues.slug;

  function setField(field: keyof CategoryFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function onNameChange(value: string) {
    setValues((current) => ({
      ...current,
      name: value,
      slug: slugOwned ? current.slug : slugify(value),
    }));
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateCategoryAction(categoryId ?? "", formData)
          : await createCategoryAction(formData);

        // A saved category redirects, so anything returned is a refusal.
        if (result) setState(result);
      } catch (error) {
        // `redirect()` arrives as a thrown control-flow signal; catching it
        // would report a successful save as a failure.
        unstable_rethrow(error);
        setState({ formError: ADMIN_REQUEST_FAILED, fieldErrors: {} });
      }
    });
  }

  const { fieldErrors } = state;

  return (
    <form
      action={submit}
      className="flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-background p-4"
    >
      {state.formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.formError}
        </p>
      ) : null}

      <FormField
        name="name"
        label="Name"
        value={values.name}
        onChange={(event) => onNameChange(event.target.value)}
        error={fieldErrors.name}
        autoComplete="off"
        required
      />

      <div className="flex flex-col gap-1.5">
        <FormField
          name="slug"
          label="URL slug"
          value={values.slug}
          onChange={(event) => {
            setField("slug", event.target.value);
            setSlugOwned(true);
          }}
          error={fieldErrors.slug}
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
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Changing the slug breaks existing links. Anything pointing at{" "}
              <code className="font-mono">
                /products/category/{initialValues.slug}
              </code>{" "}
              will start returning &ldquo;not found&rdquo;.
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>

        <textarea
          id="description"
          name="description"
          rows={3}
          value={values.description}
          onChange={(event) => setField("description", event.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={
            fieldErrors.description ? "description-error" : "description-hint"
          }
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />

        {fieldErrors.description ? (
          <p id="description-error" className="text-xs text-destructive">
            {fieldErrors.description}
          </p>
        ) : (
          <p id="description-hint" className="text-xs text-muted-foreground">
            Optional.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
        </Button>

        <Link
          href={ADMIN_CATEGORIES_PATH}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
