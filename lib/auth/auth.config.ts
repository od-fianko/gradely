import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { role?: Role; isVerified?: boolean; universityId?: string | null; level?: number | null };
        token.id = user.id ?? "";
        token.role = u.role ?? "STUDENT";
        token.isVerified = u.isVerified ?? true;
        token.universityId = u.universityId ?? null;
        token.level = u.level ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.isVerified = Boolean(token.isVerified);
        session.user.universityId = (token.universityId as string | null) ?? null;
        session.user.level = (token.level as number | null) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
};
