/** @type {import('next').NextConfig} */
const buildCpusRaw = Number(process.env.NEXT_BUILD_CPUS);
const buildCpus =
  Number.isFinite(buildCpusRaw) && buildCpusRaw > 0
    ? Math.max(1, Math.min(Math.floor(buildCpusRaw), 8))
    : null;

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["pg", "bcrypt", "@prisma/client", "@prisma/adapter-pg"],
  // Docker/Render: host CPU count can be huge (e.g. 47) and OOM during
  // "Collecting page data". Cap workers when NEXT_BUILD_CPUS is set.
  ...(buildCpus
    ? {
        experimental: {
          cpus: buildCpus,
        },
      }
    : {}),
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
    "127.0.0.1",
    "localhost",
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
