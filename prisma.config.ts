import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon pooled URL for the app
    url: process.env.DATABASE_URL,
    // Neon direct (non-pooler) URL for migrations
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
