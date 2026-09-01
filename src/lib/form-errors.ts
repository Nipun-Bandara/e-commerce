import * as z from "zod";

/**
 * Turning a Zod failure into the per-field messages a form renders.
 *
 * Shared by every form in the app rather than rewritten per feature: the shape
 * a form needs — one message, under one input — is the same whether the input
 * is a password or a postal code, and the "first message wins" rule below is a
 * decision worth making once.
 *
 * The module is dependency-free on purpose. Forms import the state types that
 * use this record across the client boundary, and a type that drags a
 * `server-only` module with it would break the build.
 */

/**
 * One message per input.
 *
 * Zod reports every rule a value broke, but a field can only usefully show the
 * first thing wrong with it — a list under one input reads as shouting, and the
 * second message is usually a consequence of the first.
 *
 * `Field` is supplied by the caller so the result is typed to that form's own
 * inputs, and a renamed field turns into a compile error rather than a message
 * that silently stops appearing.
 */
export function toFieldErrors<Field extends string>(
  error: z.ZodError<unknown>,
): Partial<Record<Field, string>> {
  const { fieldErrors } = z.flattenError(error);
  const result: Partial<Record<Field, string>> = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const [first] = messages as string[];
    if (first) result[field as Field] = first;
  }

  return result;
}
