import { Role } from "@prisma/client";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db/client";

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;

export type AuthStatus = "onboarding" | "active";

const providers =
  googleId && googleSecret
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
          authorization: {
            params: {
              prompt: "select_account",
            },
          },
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers,
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-laining-auth.session-token" : "laining-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, account, user, trigger, session }) {
      if (trigger === "update" && session) {
        const nextSession = session as {
          authStatus?: AuthStatus;
          role?: Role;
          userId?: string;
        };

        if (nextSession.userId) {
          token.userId = nextSession.userId;
        }

        if (nextSession.role) {
          token.role = nextSession.role;
        }

        if (nextSession.authStatus) {
          token.status = nextSession.authStatus;
        }

        return token;
      }

      if (account?.provider === "google" && user) {
        const email = (user.email ?? "").trim().toLowerCase();
        const existingUser = email
          ? await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
          : null;

        token.status = existingUser ? "active" : "onboarding";
        token.role = existingUser?.role ?? Role.USER;
        token.userId = existingUser?.id ?? token.sub ?? user.email ?? "";
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.picture = user.image ?? token.picture;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string | undefined) ?? token.sub ?? token.email ?? "";
        session.user.role = (token.role as Role | undefined) ?? Role.USER;
        session.user.status = (token.status as AuthStatus | undefined) ?? "active";
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
