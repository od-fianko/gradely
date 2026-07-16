import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { courseId } = await params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lecturer: { select: { id: true, name: true, email: true } },
        _count:   { select: { enrollments: true, assignments: true } },
      },
    });
    if (!course) return notFound("Course");
    return ok(course);
  } catch (e) { return handleApiError(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { courseId } = await params;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return notFound("Course");
    if (course.lecturerId !== session.user.id && session.user.role !== "ADMIN")
      return forbidden();

    const body = await req.json();
    const updated = await prisma.course.update({ where: { id: courseId }, data: body });
    return ok(updated);
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { courseId } = await params;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return notFound("Course");
    if (course.lecturerId !== session.user.id && session.user.role !== "ADMIN")
      return forbidden();

    await prisma.course.delete({ where: { id: courseId } });
    return ok(null, "Course deleted");
  } catch (e) { return handleApiError(e); }
}
