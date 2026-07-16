import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  const user = {
    name:  session.user.name  ?? "User",
    email: session.user.email ?? "",
    role:  session.user.role  ?? "STUDENT",
    image: session.user.image ?? null,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
