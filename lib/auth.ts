import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db/client";

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;

const providers =
  googleId && googleSecret
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers,
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user.role as Role | undefined) ?? Role.USER;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};

export function auth() {
  return getServerSession(authOptions);
}
