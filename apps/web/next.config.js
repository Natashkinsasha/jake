/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' wss://api.deepgram.com https://api.deepgram.com wss://api.elevenlabs.io https://api.elevenlabs.io${isDev ? " ws://localhost:4000 http://localhost:4000" : ""}`,
  "img-src 'self' https://lh3.googleusercontent.com data:",
  "media-src 'self' blob: https://storage.googleapis.com",
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
      // NestJS auth endpoints (must come before the catch-all exclusion)
      {
        source: "/api/auth/google",
        destination: "http://localhost:4000/auth/google",
      },
      {
        source: "/api/auth/me/:path*",
        destination: "http://localhost:4000/auth/me/:path*",
      },
      {
        source: "/api/:path((?!auth).*)",
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
