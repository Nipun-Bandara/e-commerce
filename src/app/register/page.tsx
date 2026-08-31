import type { Metadata } from "next";

import RegisterForm from "@/components/register-form";
import { safeCallbackUrl } from "@/lib/callback-url";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an ecom account to keep your cart and track orders.",
};

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Keep your cart and follow your orders.
        </p>
      </header>

      <RegisterForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </div>
  );
}
