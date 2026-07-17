import { requireAuth } from "@/lib/auth/session";
import type { Metadata } from "next";
import { ProfileSettings } from "@/features/profile/components/profile-settings";

export const metadata: Metadata = { title: "Profile & Settings — Gradely" };

export default async function ProfilePage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile & Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account details and preferences.</p>
      </div>

      <ProfileSettings
        user={{
          name:  session.user.name  ?? "User",
          email: session.user.email ?? "",
          role:  session.user.role  ?? "STUDENT",
        }}
      />
    </div>
  );
}
