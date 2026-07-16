import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { createCourseSchema } from "@/features/courses/schemas/course.schema";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id, role } = session.user;

    const courses = await prisma.course.findMany({
      where: role === "LECTURER" ? { lecturerId: id }
           : role === "STUDENT"  ? { enrollments: { some: { studentId: id } } }
           : undefined,
      include: {
        lecturer: { select: { name: true, email: true } },
        _count:   { select: { enrollments: true, assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(courses);
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can create courses");

    const body = await req.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const existing = await prisma.course.findUnique({ where: { code: parsed.data.code } });
    if (existing) return badRequest(`Course code ${parsed.data.code} already exists`);

    const course = await prisma.course.create({
      data: { ...parsed.data, lecturerId: session.user.id },
    });
    return ok(course, "Course created", 201);
  } catch (e) { return handleApiError(e); }
}
