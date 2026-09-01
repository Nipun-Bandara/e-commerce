"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import FormField from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { emptyAuthFormState } from "@/lib/auth-schemas";
import { loginAction } from "@/server/auth-actions";

/**
 * Email and password, and one message when they are wrong.
 *
 * That message is the same whether the address is unregistered or the password
 * is a typo — see `verifyCredentials`. Telling someone "no account with that
 * email" turns the login form into a tool for finding out who has an account
 * here, which is worth more to an attacker than it is to the person typing.
 *
 * The form is uncontrolled: `useActionState` posts it, and the action sends
 * back the email so a failed attempt does not make them type it again. The
 * password is never echoed.
 */
export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    emptyAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Where to land after signing in. Re-sanitised on the server — this is a
          hidden input, which means it is a value the browser can edit. */}
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
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
        required
        autoFocus
      />

      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors.password}
        required
      />

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
