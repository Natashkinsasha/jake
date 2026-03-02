/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jake/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

module.exports = nextConfig;
