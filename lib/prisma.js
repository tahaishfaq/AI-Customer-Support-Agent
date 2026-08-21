import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { withVerifyFullSsl } from "@/lib/pg-connection";

const globalForPrisma = globalThis;
const PRISMA_GEN = "platform-settings-v2";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Neon URLs."
    );
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

function getPrisma() {
  let client = globalForPrisma.prisma;
  const stale =
    globalForPrisma.prismaGen !== PRISMA_GEN ||
    !client ||
    typeof client.platformSettings?.upsert !== "function";
  if (stale) {
    client = createPrismaClient();
    globalForPrisma.prisma = client;
    globalForPrisma.prismaGen = PRISMA_GEN;
  }
  return client;
}

/**
 * Lazy client so importing this module during `next build` / Edge bundling
 * does not connect to Neon or throw on missing DATABASE_URL.
 */
const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then" || prop === "$$typeof") return undefined;
      const client = getPrisma();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export default prisma;
