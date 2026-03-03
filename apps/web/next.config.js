/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' wss://api.deepgram.com https://api.deepgram.com${isDev ? " ws://localhost:4000 http://localhost:4000" : ""}`,
  "img-src 'self' https://lh3.googleusercontent.com data:",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
];

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@jake/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth|stt).*)",
        destination: "http://localhost:4000/:path",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:4000/socket.io/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
