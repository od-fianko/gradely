import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();
    const { courseId } = await params;

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    return ok(enrollments);
  } catch (e) { return handleApiError(e); }
}
