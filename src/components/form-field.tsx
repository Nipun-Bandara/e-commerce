"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One labelled input, with its error message. Used by every form in the app.
 *
 * The error is wired up with `aria-describedby` and `aria-invalid` rather than
 * just rendered in red: a screen reader otherwise announces the field as fine
 * and the message as a stray sentence somewhere below it.
 *
 * Controlled or not is the caller's choice. The auth forms are uncontrolled and
 * pass `defaultValue`, because the server echoes back what was typed so a
 * rejected submit does not blank them; checkout is controlled and passes
 * `value`, because picking a saved address rewrites every field at once.
 */
export default function FormField({
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
