/**
 * Edge-safe Auth.js config (used by proxy.js).
 * No Prisma, pg, bcrypt, or Google token verification here —
 * those belong in auth.js (Node runtime only).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role || "USER";
        token.status = user.status || "ACTIVE";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
        session.user.role = token.role || "USER";
        session.user.status = token.status || "ACTIVE";
      }
      return session;
    },
  },
  trustHost: true,
};
