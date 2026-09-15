/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Tesseract starts its own Node worker. Keeping it external prevents Next
    // from rewriting worker-script paths into a non-existent .next route.
    serverComponentsExternalPackages: ["tesseract.js"],
  },
};
export default nextConfig;
