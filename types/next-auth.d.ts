import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";
import { AuthStatus } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: Role;
      status: AuthStatus;
    };
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    status?: AuthStatus;
  }
}
