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
};

export default nextConfig;
