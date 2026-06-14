/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose the build's git commit SHA to the client so the live deploy is
  // verifiable: rendered on <body data-build> (see src/app/layout.tsx).
  // Vercel sets VERCEL_GIT_COMMIT_SHA at build time; empty locally.
  env: {
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
  },
  images: {
    remotePatterns: [
      // Google account avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Supabase Storage (org logos, later phases)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
