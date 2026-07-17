import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { CourseCard } from "@/features/courses/components/course-card";
import { CreateCourseDialog } from "@/features/courses/components/create-course-dialog";
import { BookOpen, GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "My Courses — Gradely" };

export default async function LecturerCoursesPage() {
  const session = await requireRole("LECTURER");

  const courses = await prisma.course.findMany({
    where:   { lecturerId: session.user.id },
    include: { _count: { select: { enrollments: true, assignments: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-500" />
            My Courses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {courses.length} course{courses.length !== 1 ? "s" : ""} · manage content and students
          </p>
        </div>
        <CreateCourseDialog />
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="font-semibold text-foreground/90 mb-1">No courses yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create your first course to get started. Students will be able to enroll and submit assignments.
          </p>
          <div className="mt-6"><CreateCourseDialog /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} role="LECTURER" />
          ))}
        </div>
      )}
    </div>
  );
}
