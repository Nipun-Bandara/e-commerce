import type { Metadata } from "next";

import LoginForm from "@/components/login-form";
import { safeCallbackUrl } from "@/lib/callback-url";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your ecom account.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Your cart comes with you.
        </p>
      </header>

      {/* Sanitised here rather than in the form: the query string is untrusted
          input, and the closer it is cleaned to where it arrives, the harder it
          is for a later edit to forget. `loginAction` cleans it again anyway. */}
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </div>
  );
}
