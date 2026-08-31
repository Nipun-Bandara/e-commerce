"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import {
  emptyAuthFormState,
  loginSchema,
  registerSchema,
  toFieldErrors,
  type AuthFormState,
} from "@/lib/auth-schemas";
import { safeCallbackUrl } from "@/lib/callback-url";
import { mergeGuestCart } from "@/server/cart";
import { createUser, getUserByEmail } from "@/server/users";

/**
 * Sign up, log in, log out.
 *
 * Split from the query layer for the reason `cart-actions.ts` gives: `"use
 * server"` makes every export a public HTTP endpoint, and only these three
 * belong on the network. `verifyCredentials`, `createUser` and `mergeGuestCart`
 * stay in plain server modules where the browser cannot call them directly.
 *
 * Both sign-in paths do the same four things in the same order, and the order
 * matters:
 *
 *  1. **Validate on the server.** The browser's `required` and `type="email"`
 *     are hints to a person typing. A form post is an HTTP request and arrives
 *     with whatever fields the sender chose, so Zod runs here regardless.
 *  2. **Issue the session.**
 *  3. **Merge the guest cart**, while the guest cookie is still in hand.
 *  4. **Revalidate, then redirect.** The header renders the signed-in state and
 *     the cart badge on every route, so the whole layout is stale until it is
 *     told otherwise.
 */

/** The one thing a failed login is ever told. See `verifyCredentials`. */
const INVALID_CREDENTIALS = "Invalid email or password.";

/** A dropped connection or a thrown query, phrased for someone mid-signup. */
const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

function failure(
  state: Partial<AuthFormState> & { values: AuthFormState["values"] },
): AuthFormState {
  return { ...emptyAuthFormState, ...state };
}

/**
 * Hand the credentials to Auth.js.
 *
 * Auth.js signals a rejected password by throwing, not by returning, and it
 * throws the same `AuthError` whether the email was unknown or the password was
 * wrong — which is what makes one generic message honest rather than a
 * pretence. Anything that is *not* an `AuthError` is a real fault and is
 * rethrown, so a broken database does not masquerade as a typo.
 */
async function signInWithCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    // `redirect: false` because this action decides where to go, after the cart
    // has been merged. Letting Auth.js redirect would end the request first.
    await signIn("credentials", { email, password, redirect: false });
    return true;
  } catch (error) {
    if (error instanceof AuthError) return false;
    throw error;
  }
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  // Echoed back so a rejected submit does not blank the form. Passwords never
  // make the return trip.
  const values = {
    name: typeof submitted.name === "string" ? submitted.name : "",
    email: typeof submitted.email === "string" ? submitted.email : "",
  };

  const parsed = registerSchema.safeParse(submitted);
  if (!parsed.success) {
    return failure({ fieldErrors: toFieldErrors(parsed.error), values });
  }

  const { name, email, password } = parsed.data;

  // `role` is not read from `parsed.data` and is not in the schema. A new
  // account is a USER, decided inside `createUser`.
  const result = await createUser({ name, email, password });

  if (result.status === "email-taken") {
    // Sign-up is the one place this cannot be hidden — the address either can
    // be registered or it cannot — so it says so plainly rather than failing
    // with a message that would send someone round in circles.
    return failure({
      fieldErrors: { email: "An account with that email already exists." },
      values,
    });
  }

  const signedIn = await signInWithCredentials(email, password);
  if (!signedIn) {
    // The account exists but the session did not issue. Sending them to log in
    // is better than a dead end, and their password does work.
    return failure({
      formError: "Your account was created, but signing in failed. Please log in.",
      values,
    });
  }

  await mergeGuestCart(result.user.id);

  revalidatePath("/", "layout");
  redirect(safeCallbackUrl(formData.get("callbackUrl")));
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const values = {
    email: typeof submitted.email === "string" ? submitted.email : "",
  };

  const parsed = loginSchema.safeParse(submitted);
  if (!parsed.success) {
    return failure({ fieldErrors: toFieldErrors(parsed.error), values });
  }

  const { email, password } = parsed.data;

  const signedIn = await signInWithCredentials(email, password);
  if (!signedIn) {
    return failure({ formError: INVALID_CREDENTIALS, values });
  }

  // Re-read rather than trust the session: the token was set on the *response*,
  // and the merge needs a user id now. One indexed lookup on an email that has
  // just been proven correct.
  const user = await getUserByEmail(email);
  if (!user) return failure({ formError: UNEXPECTED_ERROR, values });

  await mergeGuestCart(user.id);

  revalidatePath("/", "layout");
  redirect(safeCallbackUrl(formData.get("callbackUrl")));
}

/**
 * Clear the session and go home.
 *
 * Home rather than back where they were: the page they are on may be one they
 * can no longer see, and being bounced to a login screen is a confusing way to
 * be told you logged out.
 *
 * The guest cart cookie is not reissued here. Signing out leaves the cart with
 * the account, which is where the visitor put it.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });

  revalidatePath("/", "layout");
  redirect("/");
}
