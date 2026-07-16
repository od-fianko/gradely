import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { CourseCard } from "@/features/courses/components/course-card";
import { ExploreCourses } from "@/features/courses/components/explore-courses";
import { BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Courses — Gradely" };

export default async function StudentCoursesPage() {
  const session = await requireRole("STUDENT");

  const enrolled = await prisma.enrollment.findMany({
    where:   { studentId: session.user.id },
    include: {
      course: {
        include: {
          lecturer: { select: { name: true, email: true } },
          _count:   { select: { enrollments: true, assignments: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enrolledCourses = enrolled.map((e) => e.course);
  const enrolledIds = new Set(enrolledCourses.map((c) => c.id));

  const allActive = await prisma.course.findMany({
    where:   { isActive: true, id: { notIn: [...enrolledIds] } },
    include: {
      lecturer: { select: { name: true, email: true } },
      _count:   { select: { enrollments: true, assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-500" />
          Courses
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enrolled in {enrolledCourses.length} course{enrolledCourses.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs defaultValue="enrolled">
        <TabsList className="mb-4">
          <TabsTrigger value="enrolled">My Courses ({enrolledCourses.length})</TabsTrigger>
          <TabsTrigger value="explore">Explore ({allActive.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="enrolled">
          {enrolledCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                <BookOpen className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No enrollments yet</h3>
              <p className="text-sm text-muted-foreground">Switch to Explore to find courses to join.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {enrolledCourses.map((c) => (
                <CourseCard key={c.id} course={c} role="STUDENT" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="explore">
          <ExploreCourses courses={allActive} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
