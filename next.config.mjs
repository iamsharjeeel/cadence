/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
