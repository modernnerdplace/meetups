/** @type {import('next').NextConfig} */
const nextConfig = {
  // De productie-image draait Next in standalone-modus.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Speaker and cover images are hosted elsewhere (meetup.com, Discord, personal sites).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
