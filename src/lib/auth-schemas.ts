import * as z from "zod";

import { toFieldErrors as toFormFieldErrors } from "@/lib/form-errors";

/**
 * What a valid sign-up or login submission looks like, and the shape the forms
 * get back when it is not one.
 *
 * These schemas exist so the **server** can decide. The browser gets `required`
 * and `type="email"` on the inputs, which is a courtesy to someone typing, not
 * a check: a form post is an HTTP request like any other and arrives with
 * whatever fields the sender chose. Every rule below is re-run in the Server
 * Action before anything is written.
 *
 * The module is dependency-free on purpose — the forms import `AuthFormState`
 * to type their `useActionState`, and a type reaching across the client
 * boundary must not drag a `server-only` module with it.
 */

/**
 * Short enough not to annoy, long enough to matter. Length is the only rule:
 * composition requirements ("one number, one symbol") reliably produce
 * `Password1!` and nothing safer.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Trim and lowercase *before* validating, not after: `"  A@B.lk "` is a
 * perfectly good address that fails an email check until it has been cleaned
 * up. `.pipe()` is what orders the two.
 */
const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const loginSchema = z.object({
  email,
  // No length rule on login. The password either matches the stored hash or it
  // does not, and telling someone their guess was "too short" is a hint.
  password: z.string({ error: "Enter your password." }).min(1, {
    error: "Enter your password.",
  }),
});

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Enter your name." })
      .trim()
      .min(1, { error: "Enter your name." })
      .max(80, { error: "That name is too long." }),
    email,
    password: z.string({ error: "Choose a password." }).min(MIN_PASSWORD_LENGTH, {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    }),
    confirmPassword: z.string({ error: "Confirm your password." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Those passwords do not match.",
    // Without a path the message lands on the object rather than a field, and
    // the form would have nowhere to show it.
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Every input either form can complain about. */
export type AuthField = "name" | "email" | "password" | "confirmPassword";

export type AuthFormState = {
  /** Shown above the form — a failed login, a duplicate email, a dropped request. */
  formError: string | null;
  /** Shown under the input it belongs to. */
  fieldErrors: Partial<Record<AuthField, string>>;
  /**
   * What was typed, echoed back so a rejected submit does not empty the form.
   * Passwords are never in here.
   */
  values: { name?: string; email?: string };
};

export const emptyAuthFormState: AuthFormState = {
  formError: null,
  fieldErrors: {},
  values: {},
};

/** Turn a Zod failure into the per-field messages the forms render. */
export function toFieldErrors(
  error: z.ZodError<unknown>,
): Partial<Record<AuthField, string>> {
  return toFormFieldErrors<AuthField>(error);
}
