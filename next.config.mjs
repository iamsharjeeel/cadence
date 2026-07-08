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
  // Defense-in-depth security headers applied to every response. These are the
  // non-breaking set (clickjacking, MIME-sniffing, transport, referrer,
  // powerful-feature lockdown). A full content CSP (script-src/style-src) is
  // deliberately NOT set here — it needs per-route testing against inline
  // scripts, GSAP/framer-motion, and the Google/Supabase origins first.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
