/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  experimental: {
    // Next.js 14.x key — renamed to serverExternalPackages in Next.js 15+
    serverComponentsExternalPackages: [
      "@google-cloud/vertexai",
      "@modelcontextprotocol/sdk",
      "@neondatabase/serverless",
      "playwright-core",
    ],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NEXT_PUBLIC_APP_URL ?? "*",
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
