import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { authConfig } from "@/auth.config";
import { ensureDefaultWorkspace } from "@/lib/services/workspace.service";
import { isRateLimited, rateLimit } from "@/lib/rate-limit";
import { isProtectedAdminEmail } from "@/lib/admin-email";

class AccountSuspendedError extends CredentialsSignin {
  code = "account_suspended";
}

class SignupsClosedError extends CredentialsSignin {
  code = "signups_closed";
}

class AdminPasswordOnlyError extends CredentialsSignin {
  code = "admin_password_only";
}

class AdminNeedsSeedError extends CredentialsSignin {
  code = "admin_needs_seed";
}

class TooManyAttemptsError extends CredentialsSignin {
  code = "too_many_attempts";
}

async function rejectAdminGoogle(user) {
  if (!user) return;
  if (user.role === "ADMIN" || (await isProtectedAdminEmail(user.email))) {
    throw new AdminPasswordOnlyError();
  }
}

function toAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role || "USER",
    status: user.status || "ACTIVE",
  };
}

/**
 * Auth.js (NextAuth v5) — Node runtime (API routes).
 * Edge/proxy uses auth.config.js only so Vercel does not bundle Prisma/pg/bcrypt.
 */

const providers = [
  Credentials({
    id: "credentials",
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toString().trim().toLowerCase();
      const password = credentials?.password?.toString();

      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      const protectedAdmin = await isProtectedAdminEmail(email);
      const adminLogin = protectedAdmin || user?.role === "ADMIN";
      const adminLimitKey = `admin-login:${email}`;
      const adminLimitOpts = { limit: 5, windowMs: 15 * 60_000 };

      // Count failed guesses only; block before hashing when the window is full.
      if (adminLogin) {
        const limited = isRateLimited(adminLimitKey, adminLimitOpts);
        if (!limited.ok) throw new TooManyAttemptsError();
      }

      // Reserved / ADMIN email without password → ops must run seed:admin (F06-B).
      if (adminLogin && !user?.passwordHash) {
        rateLimit(adminLimitKey, adminLimitOpts);
        throw new AdminNeedsSeedError();
      }

      if (!user?.passwordHash) {
        return null;
      }

      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        if (adminLogin) rateLimit(adminLimitKey, adminLimitOpts);
        return null;
      }
      if (user.status === "SUSPENDED") throw new AccountSuspendedError();

      prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {});

      return toAuthUser(user);
    },
  }),
  Credentials({
    id: "google-id-token",
    name: "Google ID Token",
    credentials: {
      idToken: { label: "ID Token", type: "text" },
    },
    async authorize(credentials) {
      const idToken = credentials?.idToken?.toString();
      if (!idToken) return null;

      const clientId =
        process.env.GOOGLE_CLIENT_ID ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        process.env.AUTH_GOOGLE_ID;

      if (!clientId) return null;

      const client = new OAuth2Client(clientId);
      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken,
          audience: clientId,
        });
      } catch {
        return null;
      }

      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) return null;
      if (payload.email_verified === false) return null;

      const email = payload.email.toLowerCase();
      const googleId = payload.sub;
      const name = payload.name || email.split("@")[0];
      const image = payload.picture || null;

      if (await isProtectedAdminEmail(email)) {
        throw new AdminPasswordOnlyError();
      }

      let user = await prisma.user.findUnique({ where: { googleId } });
      await rejectAdminGoogle(user);

      if (!user) {
        user = await prisma.user.findUnique({ where: { email } });
        await rejectAdminGoogle(user);
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId,
              image: user.image || image,
              emailVerified: user.emailVerified || new Date(),
            },
          });
        } else {
          const { getPlatformSettings } = await import(
            "@/lib/services/platform-settings.service"
          );
          const settings = await getPlatformSettings();
          if (!settings.signupsEnabled) throw new SignupsClosedError();
          user = await prisma.user.create({
            data: {
              name,
              email,
              googleId,
              image,
              passwordHash: null,
              emailVerified: new Date(),
              role: "USER",
              status: "ACTIVE",
            },
          });
          await ensureDefaultWorkspace(user.id);
        }
      }

      if (user.status === "SUSPENDED") throw new AccountSuspendedError();

      prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {});

      return toAuthUser(user);
    },
  }),
];

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      const provider = account?.provider;
      if (provider === "google" || provider === "google-id-token") {
        const email = user?.email?.toLowerCase();
        if (await isProtectedAdminEmail(email)) return false;
        if (user?.id) {
          const row = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, email: true },
          });
          if (
            row?.role === "ADMIN" ||
            (await isProtectedAdminEmail(row?.email))
          ) {
            return false;
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        });
        token.sub = dbUser?.id || user.id;
        token.name = dbUser?.name || user.name;
        token.email = dbUser?.email || user.email;
        token.role = dbUser?.role || user.role || "USER";
        token.status = dbUser?.status || user.status || "ACTIVE";
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      if (user?.id) {
        await ensureDefaultWorkspace(user.id);
      }
    },
  },
});
