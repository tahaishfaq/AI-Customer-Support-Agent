import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import { comparePassword } from "@/lib/password";

/**
 * Auth.js (NextAuth v5)
 * - Email/password → Credentials
 * - Google GIS button → Credentials "google-id-token" (same UX, NextAuth session)
 * - Optional Google OAuth if AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET set
 *
 * Credentials require session strategy "jwt" (Auth.js managed cookie — not DIY jsonwebtoken).
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
      if (!user?.passwordHash) return null;

      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
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

      let user = await prisma.user.findUnique({ where: { googleId } });

      if (!user) {
        user = await prisma.user.findUnique({ where: { email } });
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
          user = await prisma.user.create({
            data: {
              name,
              email,
              googleId,
              image,
              passwordHash: null,
              emailVerified: new Date(),
            },
          });
        }
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
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
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
      }
      return session;
    },
  },
  trustHost: true,
});
