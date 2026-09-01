"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import FormField from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { emptyAuthFormState } from "@/lib/auth-schemas";
import { registerAction } from "@/server/auth-actions";

/**
 * Name, email, password, confirm.
 *
 * `minLength` and `type="email"` are here so the browser can catch the obvious
 * mistakes before a round trip — they are not the validation. Every rule is
 * re-run with Zod in `registerAction`, which is the only one that decides
 * anything; these attributes exist to save someone a page load.
 *
 * A successful sign-up logs in and redirects, so there is no success state to
 * render here.
 */
export default function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    emptyAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
        autoComplete="name"
        defaultValue={state.values.name}
        error={state.fieldErrors.name}
        required
        maxLength={80}
        autoFocus
      />

      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
        required
      />

      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={state.fieldErrors.password}
        required
        minLength={8}
      />

      <FormField
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors.confirmPassword}
        required
      />

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
