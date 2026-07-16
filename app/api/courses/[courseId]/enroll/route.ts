import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("Only students can enroll");
    const { courseId } = await params;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.isActive) return notFound("Course");

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: session.user.id, courseId } },
    });
    if (existing) return badRequest("Already enrolled in this course");

    const enrollment = await prisma.enrollment.create({
      data: { studentId: session.user.id, courseId },
    });
    return ok(enrollment, "Enrolled successfully", 201);
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden();
    const { courseId } = await params;

    await prisma.enrollment.delete({
      where: { studentId_courseId: { studentId: session.user.id, courseId } },
    });
    return ok(null, "Unenrolled");
  } catch (e) { return handleApiError(e); }
}
