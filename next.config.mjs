/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["pg", "bcrypt", "@prisma/client", "@prisma/adapter-pg"],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/billingplans",
        destination: "/billing/plans",
        permanent: true,
      },
    ];
  },
  // Allow ngrok (and similar tunnels) to load /_next/* in development —
  // without this, login/auth JS is blocked and the form looks broken.
  allowedDevOrigins: [
    "album-wielder-kinsman.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
  ],
  async headers() {
    return [
      {
        source: "/w/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/embed.js",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
