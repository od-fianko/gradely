import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isVerified: boolean;
      universityId?: string | null;
      level?: number | null;
      program?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    isVerified: boolean;
    universityId?: string | null;
    level?: number | null;
    program?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isVerified: boolean;
    universityId?: string | null;
    level?: number | null;
    program?: string | null;
  }
}
