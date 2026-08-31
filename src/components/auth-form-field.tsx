"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One labelled input on the login or sign-up form, with its error message.
 *
 * The error is wired up with `aria-describedby` and `aria-invalid` rather than
 * just rendered in red: a screen reader otherwise announces the field as fine
 * and the message as a stray sentence somewhere below it.
 *
 * `defaultValue` rather than `value` — these forms are uncontrolled, and the
 * server echoes back what was typed so a rejected submit does not blank them.
 */
export default function AuthFormField({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
  ...props
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "type" | "defaultValue">) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>

      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-9"
        {...props}
      />

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
