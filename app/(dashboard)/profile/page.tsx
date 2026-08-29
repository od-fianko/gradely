import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { ProfileSettings } from "@/features/profile/components/profile-settings";

export const metadata: Metadata = { title: "Profile & Settings — Gradely" };

export default async function ProfilePage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name: true, email: true, role: true, level: true, program: true, createdAt: true,
      university: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile & Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account details and preferences.</p>
      </div>

      <ProfileSettings
        user={{
          name:        user?.name  ?? session.user.name  ?? "User",
          email:       user?.email ?? session.user.email ?? "",
          role:        user?.role  ?? session.user.role  ?? "STUDENT",
          level:       user?.level ?? null,
          program:     user?.program ?? null,
          university:  user?.university?.name ?? null,
          memberSince: user?.createdAt ?? null,
        }}
      />
    </div>
  );
}
