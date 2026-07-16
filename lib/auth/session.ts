import { cache } from "react";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export const getSession = cache(async () => auth());

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(role: Role) {
  const session = await requireAuth();
  if (session.user.role !== role) {
    const dashboard =
      session.user.role === "ADMIN"
        ? "/admin"
        : session.user.role === "LECTURER"
        ? "/lecturer"
        : "/student";
    redirect(dashboard);
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
