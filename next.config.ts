import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product images are placeholders from picsum.photos — see `imageUrl()` in
    // prisma/seed.ts. next/image refuses any remote host that is not listed
    // here, so the seeded catalogue renders as broken images without this.
    // picsum redirects to its CDN; Next follows the redirect without
    // re-checking the pattern, so only the entry host needs allowing.
    remotePatterns: [new URL("https://picsum.photos/seed/**")],
  },

  experimental: {
    // Enables `forbidden()` and the `forbidden.tsx` boundary, which is how a
    // signed-in non-admin gets a real 403 page instead of a redirect back to a
    // login form they do not need. Still experimental in Next 16; if it is ever
    // removed, `src/server/auth.ts` is the one place that calls it.
    authInterrupts: true,
  },
};

export default nextConfig;
