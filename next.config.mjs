/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: [
    "unpdf",
    "pg",
    "bcrypt",
    "@prisma/client",
    "@prisma/adapter-pg",
  ],
  devIndicators: false,
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
