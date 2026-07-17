import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Sidebar, type SidebarCourse } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

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

  // Quick-access course list for the sidebar
  let courses: SidebarCourse[] = [];
  if (user.role === "LECTURER") {
    courses = await prisma.course.findMany({
      where:   { lecturerId: session.user.id, isActive: true },
      select:  { id: true, code: true, title: true },
      orderBy: { code: "asc" },
      take:    10,
    });
  } else if (user.role === "STUDENT") {
    const enrollments = await prisma.enrollment.findMany({
      where:   { studentId: session.user.id },
      select:  { course: { select: { id: true, code: true, title: true } } },
      orderBy: { course: { code: "asc" } },
      take:    10,
    });
    courses = enrollments.map((e) => e.course);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/60">
      <Sidebar user={user} courses={courses} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} courses={courses} />
        <main
          className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6"
          style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
        >
          {children}
        </main>
        <BottomNav role={user.role} />
      </div>
    </div>
  );
}
